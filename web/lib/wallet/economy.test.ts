import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOX_CATEGORIES, BOX_GEAR, boxPool, CATALOGUE, SETTINGS, WELCOME_TRACK } from "./catalogue";
import { memoryEconomyStore } from "./memoryStore";
import { dailySpecials, isOnSale, seedItems, sellPrice, speciesClass, speciesSellPrice, torontoDay } from "./rules";
import { DROPS } from "@/lib/game/drops";
import { ROSTER } from "@/lib/collections/roster";
import { buy, claimDailyGift, equip, getShop, getWallet, pickupCode, reserveMerch, resolveMerch, sell, sellList, type GiftView } from "./service";

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
    m.fund(A, 350);
    const rod = slug(m, "bait-sweet");
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
    expect(speciesClass("fish_coelacanth")).toEqual({ category: "fish", rarity: "epic" });
    expect(speciesClass("fish_guppy")).toEqual({ category: "fish", rarity: "common" }); // not in the roster, from FISH
    expect(speciesClass("bug_mantis")).toEqual({ category: "bug", rarity: "rare" });
    expect([sellPrice("fish", "epic"), sellPrice("bug", "rare"), sellPrice("nature", "common")]).toEqual([180, 50, 4]);
    const m = memoryEconomyStore();
    m.give(A, "fish_coelacanth", 2);
    m.give(A, "fish_guppy", 3);
    m.give(A, "acorn", 5);
    const list = await sellList(m.store, A);
    expect(list.ok && list.data.map((x) => [x.item_key, x.price_each])).toEqual([["fish_coelacanth", 180], ["fish_guppy", 8]]);
    expect(await sell(m.store, A, { item_key: "fish_guppy", qty: 3, idempotency_key: "sell-0001" })).toMatchObject({ ok: true, data: { paid: 24, remaining: 0 } });
    expect(await sell(m.store, A, { item_key: "fish_guppy", qty: 3, idempotency_key: "sell-0001" })).toMatchObject({ ok: true, data: { replayed: true } });
    expect(await sell(m.store, A, { item_key: "fish_coelacanth", qty: 3, idempotency_key: "sell-0002" })).toMatchObject({ ok: false, code: "insufficient_items" });
    expect(await sell(m.store, A, { item_key: "acorn", qty: 1, idempotency_key: "sell-0003" })).toMatchObject({ ok: false, code: "not_sellable" });
    expect(m.coinsOf(A)).toBe(24);
  });

  it("skips a favourite locked in the bag (specs/game-ui.md §7): it lists as locked and won't sell until unlocked", async () => {
    const m = memoryEconomyStore();
    m.give(A, "fish_golden_koi", 1);
    m.give(A, "fish_dace", 2);
    m.lock(A, "fish_golden_koi", true);
    const list = await sellList(m.store, A);
    expect(list.ok && list.data.map((x) => [x.item_key, x.locked])).toEqual([["fish_golden_koi", true], ["fish_dace", false]]);
    expect(await sell(m.store, A, { item_key: "fish_golden_koi", qty: 1, idempotency_key: "sell-0101" })).toMatchObject({ ok: false, code: "locked" });
    expect(await sell(m.store, A, { item_key: "fish_dace", qty: 2, idempotency_key: "sell-0102" })).toMatchObject({ ok: true, data: { paid: 16 } });
    m.lock(A, "fish_golden_koi", false);
    expect(await sell(m.store, A, { item_key: "fish_golden_koi", qty: 1, idempotency_key: "sell-0103" })).toMatchObject({ ok: true, data: { paid: 180 } });
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
    expect(m.coinsOf(A)).toBe(30 + 200 + 300); // the gifts, and welcome days 1 and 2
    expect((await getWallet(m.store, A, now)).ok).toBe(true);
  });
});

describe("the welcome week (d-streak)", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 10, 2 + n, 17)); // Nov 3 onwards, noon in Toronto
  it("pays the track on the first seven gift days and a mystery box on the seventh, then stops", async () => {
    let now = day(0);
    const m = memoryEconomyStore(() => now, () => 0.99);
    const got: (GiftView["welcome"])[] = [];
    for (let n = 0; n < 8; n++) {
      now = day(n * 2); // gift days, not a streak: a missed day doesn't reset it
      const w = await getWallet(m.store, A, now);
      expect(w.ok && w.data.welcome_day).toBe(n < 7 ? n + 1 : null);
      const r = await claimDailyGift(m.store, A);
      if (!r.ok) throw new Error(r.error);
      got.push(r.data.welcome);
    }
    expect(got.slice(0, 6).map(w => w?.coins)).toEqual([200, 300, 0, 400, 0, 600]);
    expect(got.map(w => w?.gems ?? 0)).toEqual([0, 0, 5, 0, 10, 0, 10, 0]);
    expect(m.gemsOf(A)).toBe(25);
    expect(got[6]).toMatchObject({ day: 7, coins: 0, gems: 10, item: { slug: expect.any(String), name: expect.any(String), icon: expect.stringMatching(/\.webp$/) } });
    expect(got[6]!.reel.length).toBeGreaterThan(3);
    expect(got[6]!.reel.map(p => p.slug)).toContain(got[6]!.item!.slug);
    expect(got[7]).toBeNull();
    const box = m.items.find(i => i.slug === got[6]!.item!.slug)!;
    expect(box.active && box.price_coins !== null && (box.special_pool || (BOX_GEAR as readonly string[]).includes(box.slug))).toBe(true);
    expect((await m.store.inventory(A)).some(r => r.item.slug === box.slug)).toBe(true);
    // Once a day: the same day again pays nothing and opens no box.
    expect(await claimDailyGift(m.store, A)).toMatchObject({ ok: true, data: { claimed: false, welcome: null } });
  });
  it("totals 1500 coins and 25 Gems over the week, the box on day 7 (David 2026-10-28)", () => {
    expect(WELCOME_TRACK.reduce((n, d) => n + d.coins, 0)).toBe(1500);
    expect(WELCOME_TRACK.reduce((n, d) => n + d.gems, 0)).toBe(25);
    expect(WELCOME_TRACK.map(d => d.box)).toEqual([false, false, false, false, false, false, true]);
    expect(WELCOME_TRACK[4].gems).toBe(10);
  });
  it("holds clothing and gear only, never Contraband (staff-only, David 2026-10-27)", () => {
    const items = memoryEconomyStore().items;
    const contraband = { ...items.find(i => i.special_pool && i.active && i.category === "accessory")!, id: "x-contraband", slug: "acc-contraband", rarity: "contraband" };
    const pool = boxPool([...items, contraband], new Set());
    expect(pool.length).toBeGreaterThan(10);
    expect(pool.some(i => i.id === "x-contraband")).toBe(false);
    const gear = pool.filter(i => i.category === "tool");
    expect(gear.map(i => i.slug).sort()).toEqual([...BOX_GEAR].sort());
    for (const i of pool.filter(i => i.category !== "tool")) {
      expect(BOX_CATEGORIES as readonly string[]).toContain(i.category);
      expect(i.price_coins).not.toBeNull();
      expect(i.price_coins!).toBeLessThanOrEqual(SETTINGS.welcome_box_coins);
    }
    // No merch, nothing in gems, and no furniture, wallpaper or flooring while homes are closed.
    expect(pool.some(i => ["merch", "furniture", "wallpaper", "flooring"].includes(i.category) || i.price_gems !== null)).toBe(false);
  });
  it("adds furniture only when homes open (welcome_box_furniture, off by default)", () => {
    const items = memoryEconomyStore().items;
    expect(SETTINGS.welcome_box_furniture).toBe(0);
    expect(boxPool(items, new Set()).some(i => i.category === "furniture")).toBe(false);
    const open = boxPool(items, new Set(), SETTINGS.welcome_box_coins, true);
    expect(open.some(i => i.category === "furniture")).toBe(true);
    expect(open.some(i => i.category === "wallpaper" || i.category === "flooring")).toBe(false);
  });
  it("pays coins when the member already owns everything the box could hold", async () => {
    let now = day(0);
    const m = memoryEconomyStore(() => now);
    for (const it of m.items) if (it.stackable) it.special_pool = false; // furniture never runs out: take it out of the box
    const pool = m.items.filter(i => (i.special_pool && i.active && i.price_coins !== null) || (BOX_GEAR as readonly string[]).includes(i.slug));
    for (const it of pool) m.inventory.set(`${A}:${it.id}`, { item: it, qty: 1, equipped: false, acquired_at: "" });
    for (let n = 0; n < 7; n++) { now = day(n); await claimDailyGift(m.store, A); }
    expect((await getWallet(m.store, A, now)).ok).toBe(true);
    const ledger = m.ledger.filter(l => l.member === A && l.ref === "welcome:7");
    expect(ledger.map(l => l.amount)).toEqual([300]);
  });
});

describe("merch reservations (row 47)", () => {
  it("reserve takes stock and Gems; the race for the last one has one winner", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 0, 1000);
    m.fund(B, 0, 1000);
    const keychain = slug(m, "merch-tsi-keycap-keychain");
    m.items.find((i) => i.id === keychain)!.stock = 1;
    const [x, y] = await Promise.all([reserveMerch(m.store, A, { item_id: keychain, idempotency_key: "merch-0001" }), reserveMerch(m.store, B, { item_id: keychain, idempotency_key: "merch-0002" })]);
    expect([x, y].filter((r) => r.ok)).toHaveLength(1);
    expect([x, y].find((r) => !r.ok)).toMatchObject({ code: "sold_out" });
    expect(m.gemsOf(A) + m.gemsOf(B)).toBe(2000 - 800);
    const again = await reserveMerch(m.store, A, { item_id: keychain, idempotency_key: "merch-0001" });
    if (x.ok) expect(again).toMatchObject({ ok: true, data: { replayed: true } });
  });
  it("admin cancel refunds once and restocks; fulfil is final; members can't resolve", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 0, 700);
    m.setTier(ADMIN, 1);
    const r = await reserveMerch(m.store, A, { item_id: slug(m, "merch-genesis-sticker"), idempotency_key: "merch-0003" });
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
    const sticker = slug(m, "merch-genesis-sticker");
    for (let i = 0; i < 3; i++) await reserveMerch(m.store, A, { item_id: sticker, idempotency_key: `merch-cap-${i}` });
    expect(await reserveMerch(m.store, A, { item_id: sticker, idempotency_key: "merch-cap-3" })).toMatchObject({ ok: false, code: "too_many_open" });
  });
  it("puts the keycap keychain, the lanyard and the GENESIS sticker on sale at David's prices, unlimited (specs/merch/)", async () => {
    const m = memoryEconomyStore(() => noon);
    const rows = [["merch-tsi-keycap-keychain", 800], ["merch-tsi-lanyard", 800], ["merch-genesis-sticker", 200]] as const;
    for (const [s, gems] of rows) {
      expect(CATALOGUE.find((c) => c.slug === s), s).toMatchObject({ category: "merch", price_gems: gems, price_coins: null, stock: null });
      expect(CATALOGUE.find((c) => c.slug === s)!.description, s).toMatch(/Pick up at HQ on campus\.$/);
    }
    m.fund(A, 0, 1800);
    const shop = await getShop(m.store, A, noon);
    for (const [s, gems] of rows) {
      const e = shop.ok ? shop.data.tabs.merch.find((i) => i.slug === s) : undefined;
      expect(e, s).toMatchObject({ currency: "gems", price: gems, stock: null, can_buy: true });   // Redeem on
      expect((await reserveMerch(m.store, A, { item_id: slug(m, s), idempotency_key: `merch-new-${s}` })).ok, s).toBe(true);
      expect(m.items.find((i) => i.slug === s)!.stock, s).toBeNull();                                // unlimited stays unlimited
    }
    expect(m.gemsOf(A)).toBe(0);
  });
  it("keeps the placeholder tote and sticker pack off sale: not on the merch tab, refused if reserved (David, 2026-10-22)", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 0, 5000);
    const shop = await getShop(m.store, A, noon);
    expect(shop.ok && shop.data.tabs.merch.map((i) => i.slug).sort()).toEqual(["merch-genesis-sticker", "merch-tsi-keycap-keychain", "merch-tsi-lanyard"]);
    for (const s of ["merch-tote", "merch-sticker-pack"]) {
      expect(await reserveMerch(m.store, A, { item_id: slug(m, s), idempotency_key: `merch-off-${s}` }), s).toMatchObject({ ok: false, code: "not_for_sale" });
    }
    expect(m.gemsOf(A)).toBe(5000);
  });
});

describe("inventory", () => {
  it("equips one item per slot: bait and a bobber on the rod at once (v1-gameplay x-shop)", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 2000);
    for (const [s, k] of [["bobber-lucky", "buy-0010"], ["bait-sweet", "buy-0011"]]) await buy(m.store, A, { item_id: slug(m, s), qty: 1, idempotency_key: k }, noon);
    await equip(m.store, A, { item_id: slug(m, "bobber-lucky"), equipped: true });
    const r = await equip(m.store, A, { item_id: slug(m, "bait-sweet"), equipped: true });
    const tools = r.ok ? r.data.groups.tools : [];
    expect(tools.filter((x) => x.equipped).map((x) => x.item.slug).sort()).toEqual(["bait-sweet", "bobber-lucky"]);
    expect(await equip(m.store, A, { item_id: slug(m, "net-basic"), equipped: true })).toMatchObject({ ok: false, code: "not_owned" });
  });
});

describe("the rod shop (v1-gameplay m4): the tools shelf", () => {
  it("shows the rods up to rare by tier (the starter and the workbench ones not for sale; the epic Tidewarden off the shelf), then the add-ons, and nothing hollow", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 5000);
    const shop = await getShop(m.store, A, noon);
    const tools = shop.ok ? shop.data.tabs.tools : [];
    expect(tools.slice(0, 6).map((e) => e.catalogue_ref)).toEqual(["rod_flimsy", "rod_cedar", "rod_glass", "rod_lighthouse", "bait_sweet", "bobber_lucky"]);
    expect(tools.some((e) => e.catalogue_ref === "rod_tidewarden")).toBe(false);
    expect(tools.filter((e) => e.made).map((e) => [e.catalogue_ref, e.made, e.can_buy, e.owned])).toEqual([
      ["rod_flimsy", "starter", false, 1], ["rod_lighthouse", "workbench", false, 0]]);
    for (const s of ["rod-basic", "net-mid", "shovel-mid"]) expect(tools.some((e) => e.slug === s), s).toBe(false);
    expect(await buy(m.store, A, { item_id: slug(m, "rod-basic"), qty: 1, idempotency_key: "buy-0020" }, noon)).toMatchObject({ ok: false, code: "not_for_sale" });
  });
  it("hides home things on the one switch that opens homes in every world: the home island's drop, as the boat home and Claim your plot", () => {
    // The village and the new world alike: homes open with drop 4 (lib/game/drops.ts), whatever NEXT_PUBLIC_GAME_WORLD is.
    const sofa = seedItems().find((i) => i.slug === "furn-lounge-sofa")!, rod = seedItems().find((i) => i.slug === "rod-cedar")!;
    expect(isOnSale(sofa, noon, true)).toBe(true);
    expect(isOnSale(sofa, noon, false)).toBe(false);
    expect(isOnSale(sofa, noon)).toBe(DROPS.homeIsland);
    expect(isOnSale(rod, noon, false)).toBe(true);
  });
  it("keeps home things off the shelves until homes open", async () => {
    const m = memoryEconomyStore(() => noon);
    const shop = await getShop(m.store, A, noon);
    const home = (c: string) => ["furniture", "wallpaper", "flooring"].includes(c);
    expect(shop.ok && shop.data.tabs.furniture).toEqual([]);
    expect(shop.ok && shop.data.tabs.specials.some((e) => home(e.category))).toBe(false);
  });
});

describe("catalogue", () => {
  it("anchors prices to row 127 (the SQL seed: lib/seedMigrations.ts)", () => {
    const price = (s: string) => CATALOGUE.find((c) => c.slug === s)!.price_coins;
    expect([price("rod-basic"), price("rod-cedar")]).toEqual([100, 400]);
    expect(CATALOGUE.filter((c) => c.category === "outfit").every((c) => c.price_coins! >= 120 && c.price_coins! <= 180)).toBe(true);
    expect(CATALOGUE.filter((c) => c.category === "merch").every((c) => c.price_coins === null && c.price_gems! > 0)).toBe(true);
  });
  it("never shows a conversion between coins, Gems and money", () => {
    const text = JSON.stringify(CATALOGUE);
    expect(text).not.toMatch(/\$|CAD|dollar|USD|≈/i);
  });
});

describe("Gems have one write path", () => {
  it("no app or lib code writes profiles.tethos_coins or tc_transactions outside wallet_apply", () => {
    const web = join(__dirname, "../..");
    const files = ["app", "lib", "components"].flatMap((d) =>
      (readdirSync(join(web, d), { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => join(d, f)));
    const writers = files.filter((f) => {
      const src = readFileSync(join(web, f), "utf8");
      return /\.(update|insert|upsert)\(\s*\{[^}]*\btethos_coins\b/.test(src) || /from\("tc_transactions"\)\s*\.(insert|update|upsert|delete)/.test(src);
    });
    expect(writers).toEqual([]);
  });
});

describe("species sell prices (the catalogue editor)", () => {
  it("pays a species' own price when the roster sets one, else its category and rarity's", () => {
    const apple = ROSTER.find((s) => s.key === "apple")!;
    expect(speciesSellPrice("apple")).toBe(sellPrice("fruit", "common"));
    apple.price = 33;
    try {
      expect(speciesSellPrice("apple")).toBe(33);
    } finally {
      delete apple.price;
    }
    expect(speciesSellPrice("not_a_thing")).toBeNull();
  });
});
