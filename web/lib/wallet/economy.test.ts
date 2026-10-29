import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE, FISH_CHEF_PAY, FISH_TASK_PAY, FISH_TASK_VARIETY, STAFF_MEAL, SUSHI_MENU } from "./catalogue";
import { odds, prizeItems, rollTackle, TACKLE_COUNTERS, TACKLE_PRIZES } from "./tackle";
import { weekStart } from "@/lib/collections/logic";
import { fishOutToday } from "@/lib/game/peaceful";
import { ROSTER } from "@/lib/collections/roster";
import { memoryEconomyStore } from "./memoryStore";
import { chefOrder, dailySpecials, fishingTasks, seedItems, sellPrice, speciesClass, speciesSellPrice, torontoDay } from "./rules";
import { buy, chefView, claimDailyGift, claimFishingTask, equip, fillChefOrder, fishingTasksView, orderDish, rollAtTackle, getShop, getWallet, pickupCode, reserveMerch, resolveMerch, sell, sellList } from "./service";

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

describe("the fishing tasks (David, 2026-10-28: \"if you did it you claim it\")", () => {
  const waters = ["sea", "river"] as const;
  it("posts 3 different fish a day, common to rare, and 2 a week, the same for everyone, each paying a multiple of its sell price", () => {
    const { day, week } = fishingTasks("2026-10-27", "2026-10-26", waters);
    expect(day).toHaveLength(3);
    expect(new Set(day.map((t) => t.item_key)).size).toBe(3);
    expect(day.map((t) => t.rarity)).toEqual(["common", "uncommon", "rare"]);
    expect(fishingTasks("2026-10-27", "2026-10-26", waters)).toEqual({ day, week });
    for (const t of day) expect(t).toMatchObject({ period: "day", id: `catch:${t.item_key}`, need: 1, reward: speciesSellPrice(t.item_key!)! * FISH_TASK_PAY });
    expect(week.map((t) => t.id)).toEqual([`catch:${week[0].item_key}`, `variety:${FISH_TASK_VARIETY.need}`]);
    expect(["rare", "epic"]).toContain(week[0].rarity);
    expect(week[1]).toMatchObject({ item_key: null, need: FISH_TASK_VARIETY.need, reward: FISH_TASK_VARIETY.reward });
    const days = ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"].map((d) => fishingTasks(d, "2026-10-19", waters).day.map((t) => t.item_key).join());
    expect(new Set(days).size).toBeGreaterThan(3);
  });
  it("only asks for fish that bite in the waters given, and never a pond fish while the pond is the closed mountain's", () => {
    const pond = new Set(ROSTER.filter((s) => s.biome === "pond").map((s) => s.key));
    for (let d = 0; d < 365; d += 3) {
      const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10), month = Number(day.slice(5, 7));
      const t = fishingTasks(day, day, waters), out = new Set(fishOutToday(waters, month).map((o) => o.fish.key));
      expect([...t.day, ...t.week].every((x) => x.item_key === null || out.has(x.item_key))).toBe(true);
      expect([...t.day, ...t.week].some((x) => pond.has(x.item_key ?? ""))).toBe(false);
      expect(pond.has(chefOrder(day, waters)?.item_key ?? "")).toBe(false);
    }
  });
  it("is done when you've landed the fish (no handing over), and pays once when you claim it", async () => {
    const m = memoryEconomyStore();
    const now = noon, { day } = fishingTasks(torontoDay(now), weekStart(now), waters), [want] = day;
    const claim = (key: string, task = want.id) => claimFishingTask(m.store, A, { task, period: "day", idempotency_key: key }, now, waters);
    expect(await claim("task-0001")).toMatchObject({ ok: false, code: "not_done" });
    m.land(A, want.item_key!, new Date(now.getTime() - 86_400_000)); // yesterday's doesn't count
    expect(await claim("task-0002")).toMatchObject({ ok: false, code: "not_done" });
    m.land(A, want.item_key!, now);
    const view = await fishingTasksView(m.store, A, now, waters);
    expect(view.ok && view.data.daily.map((t) => [t.have, t.claimed])).toEqual([[1, false], [0, false], [0, false]]);
    expect(await claim("task-0003")).toMatchObject({ ok: true, data: { paid: want.reward, replayed: false } });
    expect(await claim("task-0003")).toMatchObject({ ok: true, data: { replayed: true } });
    expect(await claim("task-0004")).toMatchObject({ ok: false, code: "already_claimed" });
    expect(await claim("task-0005", "catch:fish_coelacanth")).toMatchObject({ ok: false, code: "not_requested" });
    expect(m.coinsOf(A)).toBe(want.reward);
    expect(await m.store.collections(A)).toEqual([]); // nothing taken
    const after = await fishingTasksView(m.store, A, now, waters);
    expect(after.ok && after.data.daily[0].claimed).toBe(true);
    const tomorrow = await fishingTasksView(m.store, A, new Date(now.getTime() + 86_400_000), waters);
    expect(tomorrow.ok && tomorrow.data.daily.some((t) => t.claimed || t.have)).toBe(false);
  });
  it("counts different fish landed this week for the variety task", async () => {
    const m = memoryEconomyStore();
    const keys = ROSTER.filter((s) => s.category === "fish").slice(0, FISH_TASK_VARIETY.need).map((s) => s.key);
    const claim = (key: string) => claimFishingTask(m.store, A, { task: `variety:${FISH_TASK_VARIETY.need}`, period: "week", idempotency_key: key }, noon, waters);
    for (const k of keys.slice(1)) m.land(A, k, noon);
    m.land(A, keys[1], noon);
    m.land(A, "bug_ladybug", noon);
    expect(await claim("week-0001")).toMatchObject({ ok: false, code: "not_done" });
    const view = await fishingTasksView(m.store, A, noon, waters);
    expect(view.ok && view.data.weekly[1].have).toBe(FISH_TASK_VARIETY.need - 1);
    m.land(A, keys[0], noon);
    expect(await claim("week-0002")).toMatchObject({ ok: true, data: { paid: FISH_TASK_VARIETY.reward } });
  });
});

describe("the tackle shop's rolls (David, 2026-10-28: \"one for coin one for gem, roll for 1 to 10\")", () => {
  it("shows odds that add up to 100 at each counter, with only this season's crazy ones", () => {
    for (const c of ["coins", "gems"] as const) for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      const table = odds(c, season);
      expect(table.reduce((s, o) => s + o.chance, 0)).toBeCloseTo(100, 6);
      expect(table.every((o) => !o.prize.season || o.prize.season === season)).toBe(true);
      expect(table.some((o) => o.prize.season === season)).toBe(true);
    }
    expect(odds("gems", "autumn").some((o) => o.prize.rarity === "common")).toBe(false);
  });
  it("rolls by the shown odds", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = 20000, got = new Map<string, number>();
    for (let i = 0; i < n / 10; i++) for (const p of rollTackle("coins", "autumn", 10, random)) got.set(p.rarity, (got.get(p.rarity) ?? 0) + 1);
    expect((got.get("common") ?? 0) / n).toBeCloseTo(TACKLE_COUNTERS.coins.chances.common! / 100, 1);
    expect((got.get("rare") ?? 0) / n).toBeCloseTo(TACKLE_COUNTERS.coins.chances.rare! / 100, 1);
  });
  it("charges the counter's price, grants each prize into the bag, and replays a key without charging again", async () => {
    const m = memoryEconomyStore();
    m.fund(A, 2000, 50);
    const top = () => 0.999999;
    const one = await rollAtTackle(m.store, A, { counter: "coins", pulls: 1, idempotency_key: "roll-0001" }, noon, top);
    expect(one).toMatchObject({ ok: true, data: { prizes: [expect.any(String)], replayed: false } });
    expect(m.coinsOf(A)).toBe(2000 - TACKLE_COUNTERS.coins.each);
    const ten = await rollAtTackle(m.store, A, { counter: "gems", pulls: 10, idempotency_key: "roll-0002" }, noon);
    expect(ten.ok && ten.data.prizes).toHaveLength(10);
    expect(m.gemsOf(A)).toBe(50 - TACKLE_COUNTERS.gems.ten);
    expect(await rollAtTackle(m.store, A, { counter: "gems", pulls: 10, idempotency_key: "roll-0002" }, noon)).toMatchObject({ ok: true, data: { replayed: true } });
    expect(m.gemsOf(A)).toBe(50 - TACKLE_COUNTERS.gems.ten);
    expect(await rollAtTackle(m.store, A, { counter: "gems", pulls: 10, idempotency_key: "roll-0003" }, noon)).toMatchObject({ ok: false, code: "insufficient" });
    const bag = await m.store.inventory(A);
    expect(bag.reduce((s, r) => s + r.qty, 0)).toBe(11);
    expect(bag.every((r) => !r.item.active && r.item.stackable)).toBe(true);
  });
  it("seeds every prize in its migration as the memory store has it", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261028161000_tackle_rolls.sql"), "utf8");
    for (const it of prizeItems()) expect(sql).toContain(`('${it.slug}', '${it.display_name.replace(/'/g, "''")}', 'tool', '${it.description.replace(/'/g, "''")}', ${it.price_coins}, NULL, NULL, '${it.slot}'`);
  });
  it("never shows the shop's prizes on sale", async () => {
    const m = memoryEconomyStore();
    const shop = await getShop(m.store, A, noon);
    const prizes = new Set(TACKLE_PRIZES.map((p) => p.key));
    expect(shop.ok && Object.values(shop.data.tabs).flat().some((e) => prizes.has((e as { slug: string }).slug))).toBe(false);
  });
});

describe("the sushi bar's menu, the big dish and the chef's order (f-sushi phase B)", () => {
  const waters = ["sea", "river"] as const;
  it("orders a dish for coins: its buff runs from now for its minutes, and a new meal replaces the last", async () => {
    const m = memoryEconomyStore();
    m.fund(A, 100);
    const nigiri = SUSHI_MENU.find((d) => d.id === "salmon_nigiri")!;
    const r = await orderDish(m.store, A, { dish: "salmon_nigiri", idempotency_key: "sushi-0001" }, noon);
    expect(r).toMatchObject({ ok: true, data: { paid: nigiri.price, buff: { luck: nigiri.buff.luck, size: nigiri.buff.size, until: new Date(noon.getTime() + nigiri.buff.minutes * 60_000).toISOString() } } });
    expect(await orderDish(m.store, A, { dish: "salmon_nigiri", idempotency_key: "sushi-0001" }, noon)).toMatchObject({ ok: true, data: { replayed: true } });
    expect(m.coinsOf(A)).toBe(100 - nigiri.price!);
    expect(await orderDish(m.store, A, { dish: "omakase", idempotency_key: "sushi-0002" }, noon)).toMatchObject({ ok: false, code: "insufficient" });
    await orderDish(m.store, A, { dish: "miso_soup", idempotency_key: "sushi-0003" }, noon);
    expect(await m.store.buff(A, noon)).toMatchObject({ luck: SUSHI_MENU.find((d) => d.id === "miso_soup")!.buff.luck });
    expect(await m.store.buff(A, new Date(noon.getTime() + 3_600_000))).toBeNull();
    expect(await orderDish(m.store, A, { dish: "fugu", idempotency_key: "sushi-0004" }, noon)).toMatchObject({ ok: false, code: "not_found" });
  });
  it("cooks the big dish only from one of your own epic or legendary fish, for no coins", async () => {
    const m = memoryEconomyStore();
    const feast = (fish: string, key: string) => orderDish(m.store, A, { dish: "feast", fish, idempotency_key: key }, noon);
    expect(await feast("fish_dace", "feast-0001")).toMatchObject({ ok: false, code: "not_rare_enough" });
    expect(await feast("fish_coelacanth", "feast-0002")).toMatchObject({ ok: false, code: "insufficient_items" });
    m.give(A, "fish_coelacanth", 1);
    expect(await feast("fish_coelacanth", "feast-0003")).toMatchObject({ ok: true, data: { paid: 0, buff: { luck: SUSHI_MENU.find((d) => d.id === "feast")!.buff.luck } } });
    expect(await m.store.collections(A)).toEqual([]);
    expect(await orderDish(m.store, A, { dish: "salmon_nigiri", fish: "fish_coelacanth", idempotency_key: "feast-0004" }, noon)).toMatchObject({ ok: false, code: "invalid" });
  });
  it("posts one chef's order a day, rare or epic and none of the day's tasks, that takes the fish for coins and a staff meal", async () => {
    for (const day of ["2026-10-25", "2026-10-26", "2026-10-27"]) {
      const o = chefOrder(day, waters)!;
      expect(["rare", "epic"]).toContain(o.rarity);
      expect(o.reward).toBe(speciesSellPrice(o.item_key)! * FISH_CHEF_PAY);
      expect(fishingTasks(day, day, waters).day.some((t) => t.item_key === o.item_key)).toBe(false);
    }
    const m = memoryEconomyStore();
    const o = chefOrder(torontoDay(noon), waters)!;
    const fill = (key: string, item = o.item_key) => fillChefOrder(m.store, A, { item_key: item, idempotency_key: key }, noon, waters);
    expect(await fill("chef-0001")).toMatchObject({ ok: false, code: "insufficient_items" });
    m.give(A, o.item_key, 2);
    m.lock(A, o.item_key, true);
    expect(await fill("chef-0002")).toMatchObject({ ok: false, code: "locked" });
    m.lock(A, o.item_key, false);
    expect(await fill("chef-0003")).toMatchObject({ ok: true, data: { paid: o.reward, remaining: 1 } });
    expect(await fill("chef-0003")).toMatchObject({ ok: true, data: { replayed: true } });
    expect(await fill("chef-0004")).toMatchObject({ ok: false, code: "already_filled" });
    expect(await fill("chef-0005", "fish_dace")).toMatchObject({ ok: false, code: "not_requested" });
    expect(await m.store.buff(A, noon)).toMatchObject({ luck: STAFF_MEAL.luck, size: STAFF_MEAL.size });
    const view = await chefView(m.store, A, noon, waters);
    expect(view.ok && view.data.order).toMatchObject({ item_key: o.item_key, filled: true });
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
  it("equips one item per slot", async () => {
    const m = memoryEconomyStore(() => noon);
    m.fund(A, 1000);
    const basic = slug(m, "rod-basic");
    const cedar = slug(m, "rod-cedar");
    await buy(m.store, A, { item_id: basic, qty: 1, idempotency_key: "buy-0010" }, noon);
    await buy(m.store, A, { item_id: cedar, qty: 1, idempotency_key: "buy-0011" }, noon);
    await equip(m.store, A, { item_id: basic, equipped: true });
    const r = await equip(m.store, A, { item_id: cedar, equipped: true });
    const tools = r.ok ? r.data.groups.tools : [];
    expect(tools.filter((x) => x.equipped).map((x) => x.item.slug)).toEqual(["rod-cedar"]);
    expect(await equip(m.store, A, { item_id: slug(m, "net-basic"), equipped: true })).toMatchObject({ ok: false, code: "not_owned" });
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
