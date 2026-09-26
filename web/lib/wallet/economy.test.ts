import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE } from "./catalogue";
import { memoryEconomyStore } from "./memoryStore";
import { dailySpecials, seedItems, sellPrice, speciesClass, torontoDay } from "./rules";
import { economySeedSql } from "./seed";
import { buy, claimDailyGift, equip, getShop, getWallet, pickupCode, reserveMerch, resolveMerch, sell, sellList } from "./service";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";
const noon = new Date("2026-09-24T16:00:00Z");
const slug = (m: ReturnType<typeof memoryEconomyStore>, s: string) => m.items.find((i) => i.slug === s)!.id;

describe("wallet credit/debit", () => {
  it("is idempotent per key and never goes below zero", async () => {
    const m = memoryEconomyStore();
    expect(await m.store.credit(A, "coins", 50, "admin", "x", "k-000001")).toEqual({ balance: 50, replayed: false });
    expect(await m.store.credit(A, "coins", 50, "admin", "x", "k-000001")).toEqual({ balance: 50, replayed: true });
    await expect(m.store.credit(A, "coins", -60, "shop", "x", "k-000002")).rejects.toMatchObject({ code: "insufficient" });
    expect(m.coinsOf(A)).toBe(50);
    expect(await m.store.credit(A, "coins", -50, "shop", "x", "k-000003")).toEqual({ balance: 0, replayed: false });
    expect(m.ledger.filter((l) => l.member === A)).toHaveLength(2);
  });
});

describe("buying", () => {
  it("charges the server price once per key, refuses a second copy and insufficient funds", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 150);
    const rod = slug(m, "rod-basic");
    expect(await buy(m.store, A, { item_id: rod, qty: 1, idempotency_key: "buy-0001" }, noon)).toMatchObject({ ok: true, data: { balance: 50, owned: 1, replayed: false } });
    expect(await buy(m.store, A, { item_id: rod, qty: 1, idempotency_key: "buy-0001" }, noon)).toMatchObject({ ok: true, data: { balance: 50, replayed: true } });
    expect(await buy(m.store, A, { item_id: rod, qty: 1, idempotency_key: "buy-0002" }, noon)).toMatchObject({ ok: false, code: "already_owned" });
    expect(await buy(m.store, A, { item_id: slug(m, "rod-cedar"), qty: 1, idempotency_key: "buy-0003" }, noon)).toMatchObject({ ok: false, code: "insufficient" });
    expect(m.coinsOf(A)).toBe(50);
  });
  it("sells merch only through reservation", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 0, 1000);
    expect(await buy(m.store, A, { item_id: slug(m, "merch-tote"), qty: 1, idempotency_key: "buy-0004" }, noon)).toMatchObject({ ok: false, code: "not_for_sale" });
  });
  it("applies today's special price to buys", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 1000);
    const special = dailySpecials(m.items, torontoDay(noon))[0];
    const r = await buy(m.store, A, { item_id: special.item_id, qty: 1, idempotency_key: "buy-0005" }, noon);
    expect(r).toMatchObject({ ok: true, data: { price_each: special.price_coins } });
    expect(m.coinsOf(A)).toBe(1000 - special.price_coins);
  });
});

describe("daily specials", () => {
  it("are deterministic per Toronto day, discounted, and drawn from the special pool", () => {
    const items = seedItems();
    const a = dailySpecials(items, "2026-09-24");
    expect(dailySpecials(items, "2026-09-24")).toEqual(a);
    expect(dailySpecials([...items].reverse(), "2026-09-24")).toEqual(a); // order-independent
    expect(a).toHaveLength(3);
    for (const s of a) {
      const it = items.find((i) => i.id === s.item_id)!;
      expect(it.special_pool).toBe(true);
      expect(s.price_coins).toBe(Math.floor(it.price_coins! * 0.8));
    }
    const days = ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"].map((d) => dailySpecials(items, d).map((x) => x.slug).join());
    expect(new Set(days).size).toBeGreaterThan(1);
  });
  it("rotate at Toronto midnight, not UTC", () => {
    expect(torontoDay(new Date("2026-09-25T03:30:00Z"))).toBe("2026-09-24"); // 23:30 in Toronto
    expect(torontoDay(new Date("2026-09-25T04:30:00Z"))).toBe("2026-09-25");
  });
  it("show up in the shop's specials tab", async () => {
    const m = memoryEconomyStore(() => noon);
    const shop = await getShop(m.store, A, noon);
    expect(shop.ok && shop.data.tabs.specials.map((x) => x.slug).sort()).toEqual(dailySpecials(m.items, torontoDay(noon)).map((x) => x.slug).sort());
    expect(shop.ok && shop.data.tabs.merch.every((x) => x.currency === "gems")).toBe(true);
  });
});

describe("selling by rarity (row 91)", () => {
  it("prices by category and rarity, including fish outside the launch roster", async () => {
    expect(speciesClass("fish_coelacanth")).toEqual({ category: "fish", rarity: "legendary" });
    expect(speciesClass("fish_guppy")).toEqual({ category: "fish", rarity: "common" }); // not in the roster, from FISH
    expect(speciesClass("bug_mantis")).toEqual({ category: "bug", rarity: "rare" });
    expect([sellPrice("fish", "legendary"), sellPrice("bug", "rare"), sellPrice("nature", "common")]).toEqual([600, 50, 4]);
    const m = memoryEconomyStore();
    m.give(A, "fish_coelacanth", 2);
    m.give(A, "fish_guppy", 3);
    m.give(A, "acorn", 5);
    const list = await sellList(m.store, A);
    expect(list.ok && list.data.map((x) => [x.item_key, x.price_each])).toEqual([["fish_coelacanth", 600], ["fish_guppy", 8]]);
    expect(await sell(m.store, A, { item_key: "fish_guppy", qty: 3, idempotency_key: "sell-0001" })).toMatchObject({ ok: true, data: { paid: 24, remaining: 0 } });
    expect(await sell(m.store, A, { item_key: "fish_guppy", qty: 3, idempotency_key: "sell-0001" })).toMatchObject({ ok: true, data: { replayed: true } });
    expect(await sell(m.store, A, { item_key: "fish_coelacanth", qty: 3, idempotency_key: "sell-0002" })).toMatchObject({ ok: false, code: "insufficient_items" });
    expect(await sell(m.store, A, { item_key: "acorn", qty: 1, idempotency_key: "sell-0003" })).toMatchObject({ ok: false, code: "not_sellable" });
    expect(m.coinsOf(A)).toBe(24);
  });
});

describe("daily gift", () => {
  it("pays once per Toronto day", async () => {
    let now = new Date("2026-09-25T03:00:00Z"); // Sep 24, 23:00 Toronto
    const m = memoryEconomyStore(() => now);
    expect(await claimDailyGift(m.store, A)).toMatchObject({ ok: true, data: { claimed: true, coins: 10, day: "2026-09-24" } }); // Thursday
    now = new Date("2026-09-25T03:59:00Z");
    expect(await claimDailyGift(m.store, A)).toMatchObject({ ok: true, data: { claimed: false, coins: 0 } });
    now = new Date("2026-09-25T04:01:00Z"); // midnight in Toronto: Friday
    expect(await claimDailyGift(m.store, A)).toMatchObject({ ok: true, data: { claimed: true, coins: 20, day: "2026-09-25" } });
    expect(m.coinsOf(A)).toBe(30);
    expect((await getWallet(m.store, A, now)).ok).toBe(true);
  });
});

describe("merch reservations (row 47)", () => {
  it("reserve takes stock and Gems; the race for the last one has one winner", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 0, 1000);
    m.fund(B, 0, 1000);
    const tote = slug(m, "merch-tote");
    m.items.find((i) => i.id === tote)!.stock = 1;
    const [x, y] = await Promise.all([reserveMerch(m.store, A, { item_id: tote, idempotency_key: "merch-0001" }), reserveMerch(m.store, B, { item_id: tote, idempotency_key: "merch-0002" })]);
    expect([x, y].filter((r) => r.ok)).toHaveLength(1);
    expect([x, y].find((r) => !r.ok)).toMatchObject({ code: "sold_out" });
    expect(m.gemsOf(A) + m.gemsOf(B)).toBe(2000 - 600);
    const again = await reserveMerch(m.store, A, { item_id: tote, idempotency_key: "merch-0001" });
    if (x.ok) expect(again).toMatchObject({ ok: true, data: { replayed: true } });
  });
  it("admin cancel refunds once and restocks; fulfil is final; members can't resolve", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 0, 700);
    m.setTier(ADMIN, 1);
    const r = await reserveMerch(m.store, A, { item_id: slug(m, "merch-tote"), idempotency_key: "merch-0003" });
    const id = r.ok ? r.data.reservation_id : "";
    expect(r.ok && r.data.reservation?.pickup_code).toBe(pickupCode(A, "merch-0003"));
    for (let i = 0; i < 200; i++) expect(pickupCode(`m${i}`, `key-${i}`)).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(await resolveMerch(m.store, A, { reservation_id: id, action: "cancel" })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await resolveMerch(m.store, ADMIN, { reservation_id: id, action: "cancel", note: "no pickup" })).toMatchObject({ ok: true, data: { status: "cancelled", replayed: false } });
    expect(await resolveMerch(m.store, ADMIN, { reservation_id: id, action: "cancel" })).toMatchObject({ ok: true, data: { replayed: true } });
    expect(m.gemsOf(A)).toBe(700);
    expect(await resolveMerch(m.store, ADMIN, { reservation_id: id, action: "fulfil" })).toMatchObject({ ok: false, code: "already_resolved" });
  });
  it("caps open reservations per member", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 0, 5000);
    const sticker = slug(m, "merch-sticker-pack");
    for (let i = 0; i < 3; i++) await reserveMerch(m.store, A, { item_id: sticker, idempotency_key: `merch-cap-${i}` });
    expect(await reserveMerch(m.store, A, { item_id: sticker, idempotency_key: "merch-cap-3" })).toMatchObject({ ok: false, code: "too_many_open" });
  });
});

describe("inventory", () => {
  it("equips one item per slot", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 1000);
    const hat = slug(m, "acc-straw-hat");
    const glasses = slug(m, "acc-round-glasses");
    await buy(m.store, A, { item_id: hat, qty: 1, idempotency_key: "buy-0010" }, noon);
    await buy(m.store, A, { item_id: glasses, qty: 1, idempotency_key: "buy-0011" }, noon);
    await equip(m.store, A, { item_id: hat, equipped: true });
    const r = await equip(m.store, A, { item_id: glasses, equipped: true });
    const acc = r.ok ? r.data.groups.outfits : [];
    expect(acc.filter((x) => x.equipped).map((x) => x.item.slug)).toEqual(["acc-round-glasses"]);
    expect(await equip(m.store, A, { item_id: slug(m, "rod-basic"), equipped: true })).toMatchObject({ ok: false, code: "not_owned" });
  });
});

describe("catalogue", () => {
  it("anchors prices to row 127 and is mirrored in 20260926150600_economy.sql", () => {
    const price = (s: string) => CATALOGUE.find((c) => c.slug === s)!.price_coins;
    expect([price("rod-basic"), price("rod-cedar")]).toEqual([100, 400]);
    expect(CATALOGUE.filter((c) => c.category === "outfit").every((c) => c.price_coins! >= 120 && c.price_coins! <= 180)).toBe(true);
    expect(CATALOGUE.filter((c) => c.category === "merch").every((c) => c.price_coins === null && c.price_gems! > 0)).toBe(true);
    expect(readFileSync(join(__dirname, "../../supabase/migrations/20260926150600_economy.sql"), "utf8")).toContain(economySeedSql());
  });
  it("never shows a conversion between coins, Gems and money", () => {
    const text = JSON.stringify(CATALOGUE);
    expect(text).not.toMatch(/\$|CAD|dollar|USD|≈/i);
  });
});
