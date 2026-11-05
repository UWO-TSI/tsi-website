import { describe, expect, it } from "vitest";
import { mealOf, STAFF_MEAL, SUSHI_MENU, TASTING } from "./catalogue";
import { STAT_KEYS } from "@/lib/game/rods";
import { memoryEconomyStore } from "./memoryStore";
import { bookLuck, tastingFee, tastingMarks, tastingPages, tastingWater } from "./rules";
import { orderDish, serveFish, tastingView } from "./service";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { ROSTER } from "@/lib/collections/roster";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const noon = new Date("2026-11-01T16:00:00Z");

describe("the tasting book (David, 2026-11-01: \"one per fish\"; 2026-11-02: \"perm small like 1% buff ... unlcok dishes\")", () => {
  it("has a page per water and a slot for every species a rod brings in, once", () => {
    const pages = tastingPages();
    expect(pages.map((p) => p.water)).toEqual(["river", "sea", "pond", "cliff_pool"]);
    const slots = pages.flatMap((p) => p.species);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots.sort()).toEqual(ROSTER.filter((s) => s.tool === "rod").map((s) => s.key).sort());
    expect(tastingWater("fish_dace")).toBe("river");
    expect(tastingWater("bug_ladybug")).toBeNull();
  });

  it("cooks a new fish for a fee that grows with the species cooked, stamping its slot once", async () => {
    const m = memoryEconomyStore();
    m.fund(A, 1000);
    m.give(A, "fish_dace", 2);
    m.give(A, "fish_sea_bass", 1);
    m.give(A, "fish_anchovy", 1);
    m.give(A, "fish_squid", 1);
    const serve = (key: string, fish = "fish_dace", way: "cook" | "aquarium" = "cook") => serveFish(m.store, A, { fish, way, idempotency_key: key });
    expect(await serve("tb-0001")).toMatchObject({ ok: true, data: { paid: tastingFee(0), stamped: true, remaining: 1, earned: 0 } });
    expect(m.coinsOf(A)).toBe(1000 - 100);
    expect(await m.store.buff(A, noon)).toBeNull(); // the stamp is the reward, not a meal
    expect(await serve("tb-0001")).toMatchObject({ ok: true, data: { replayed: true, stamped: true } });
    expect(m.coinsOf(A)).toBe(900);
    // A stamped fish isn't cooked again (its dish is where a second one goes).
    expect(await serve("tb-0002")).toMatchObject({ ok: false, code: "already_in_book" });
    expect(await serve("tb-0003", "fish_sea_bass")).toMatchObject({ ok: true, data: { paid: 105 } });
    await serve("tb-0004", "fish_anchovy", "aquarium");
    expect(await serve("tb-0005", "fish_squid")).toMatchObject({ ok: true, data: { paid: 110 } }); // gifts don't raise it
    expect(await tastingView(m.store, A)).toMatchObject({ ok: true, data: { book: [{ species_key: "fish_dace", way: "cooked" }, { species_key: "fish_sea_bass" }, { species_key: "fish_anchovy", way: "aquarium" }, { species_key: "fish_squid" }] } });
  });

  it("prices the fee from about 100 and the permanent luck at 1% a species to a +20% cap", () => {
    expect([0, 1, 10, 25, 50, 90].map(tastingFee)).toEqual([100, 105, 150, 225, 350, 550]);
    expect([0, 1, 10, 19, 20, 21, 40, 91].map(bookLuck)).toEqual([0, 0.01, 0.1, 0.19, 0.2, 0.2, 0.2, 0.2]);
    for (let n = 1; n <= 91; n++) expect(bookLuck(n)).toBeGreaterThanOrEqual(bookLuck(n - 1));
  });

  it("adds the book's luck to every cast, on top of a meal", async () => {
    const c = memoryCollectionsStore(() => noon);
    expect(await c.store.buff(A, noon)).toBeNull();
    c.stamp(A, 7);
    expect(await c.store.buff(A, noon)).toEqual({ luck: 0.07, size: 0 });
    c.feed(A, 0.1, 0.3, new Date(noon.getTime() + 60_000));
    const b = await c.store.buff(A, noon);
    expect(b?.luck).toBeCloseTo(0.17);
    expect(b?.size).toBe(0.3);
  });

  it("teaches a dish when its key fish fills its slot, cooked or in the tank (round 5), then serves it for coins and ingredients, all or nothing", async () => {
    const d = TASTING.dishes[0], m = memoryEconomyStore();
    m.fund(A, 1000);
    m.give(A, d.unlock, 2);
    const order = (key: string) => orderDish(m.store, A, { dish: d.id, idempotency_key: key }, noon);
    expect(await order("tb-0401")).toMatchObject({ ok: false, code: "not_learned" });
    const dace = TASTING.dishes.find((x) => x.unlock === "fish_dace")!;
    m.give(A, "fish_dace", 1);
    await serveFish(m.store, A, { fish: "fish_dace", way: "cook", idempotency_key: "tb-0406" });
    expect(await orderDish(m.store, A, { dish: dace.id, idempotency_key: "tb-0407" }, noon)).toMatchObject({ ok: false, code: "insufficient_items" });
    await serveFish(m.store, A, { fish: d.unlock, way: "aquarium", idempotency_key: "tb-0402" });
    const coins = m.coinsOf(A);
    expect(await order("tb-0403")).toMatchObject({ ok: false, code: "insufficient_items" });
    expect(m.coinsOf(A)).toBe(coins);
    expect((await m.store.collections(A)).find((r) => r.item_key === d.unlock)?.count).toBe(1);
    for (const [k, n] of d.ingredients) if (k !== d.unlock) m.give(A, k, n);
    expect(await order("tb-0404")).toMatchObject({ ok: true, data: { paid: d.price, buff: { source: d.id, luck: d.buff.luck ?? 0, size: 0 } } });
    expect(m.coinsOf(A)).toBe(coins - d.price);
    expect(await m.store.collections(A)).toEqual([]);
    expect(await m.store.buff(A, noon)).toMatchObject({ source: d.id });
    expect(await order("tb-0404")).toMatchObject({ ok: true, data: { replayed: true } });
    expect(await orderDish(m.store, A, { dish: d.id, fish: "fish_tuna", idempotency_key: "tb-0405" }, noon)).toMatchObject({ ok: false, code: "invalid" });
  });

  it("gives a fish to the club's aquarium for free, only into an empty slot", async () => {
    const m = memoryEconomyStore();
    m.give(A, "fish_pike", 2);
    m.give(B, "fish_tuna", 1);
    const serve = (who: string, fish: string, key: string) => serveFish(m.store, who, { fish, way: "aquarium", idempotency_key: key });
    expect(await serve(A, "fish_pike", "tb-0101")).toMatchObject({ ok: true, data: { paid: 0, stamped: false, remaining: 1 } });
    expect(await m.store.buff(A, noon)).toBeNull();
    expect(await serve(A, "fish_pike", "tb-0102")).toMatchObject({ ok: false, code: "already_in_book" });
    await serve(B, "fish_tuna", "tb-0103");
    // The tank is the club's: everyone's gifts, newest first.
    expect(await tastingView(m.store, A)).toMatchObject({ ok: true, data: { book: [{ species_key: "fish_pike", way: "aquarium" }], aquarium: ["fish_tuna", "fish_pike"] } });
    expect(await serveFish(m.store, A, { fish: "bug_ladybug", way: "cook", idempotency_key: "tb-0104" })).toMatchObject({ ok: false, code: "not_found" });
  });

  it("refuses a locked fish and a cook it can't pay for, keeping the fish", async () => {
    const m = memoryEconomyStore();
    m.give(A, "fish_pike", 1);
    expect(await serveFish(m.store, A, { fish: "fish_pike", way: "cook", idempotency_key: "tb-0201" })).toMatchObject({ ok: false, code: "insufficient" });
    m.lock(A, "fish_pike", true);
    expect(await serveFish(m.store, A, { fish: "fish_pike", way: "aquarium", idempotency_key: "tb-0202" })).toMatchObject({ ok: false, code: "locked" });
    expect((await m.store.collections(A))[0].count).toBe(1);
  });

  it("pays the marks as the tank fills, never for a cook, and a full water once, cooked slots counting", async () => {
    const ten = new Map(Array.from({ length: 10 }, (_, i) => [`x${i}`, "aquarium" as const]));
    expect(tastingMarks(ten, "x0")).toEqual({ earned: TASTING.marks[0].coins, marks: ["count:10"] });
    expect(tastingMarks(new Map([...ten, ["x0", "cooked" as const]]), "x0")).toEqual({ earned: 0, marks: [] });
    const m = memoryEconomyStore();
    // Nine in the tank and a tenth fish cooked: the count is the tank's, so no mark.
    const river = tastingPages().find((p) => p.water === "river")!.species;
    for (const [i, key] of river.slice(0, 9).entries()) { m.give(A, key, 1); await serveFish(m.store, A, { fish: key, way: "aquarium", idempotency_key: `tb-05${i}0` }); }
    m.fund(A, 1000);
    m.give(A, river[9], 1);
    expect(await serveFish(m.store, A, { fish: river[9], way: "cook", idempotency_key: "tb-0599" })).toMatchObject({ ok: true, data: { earned: 0, marks: [] } });
    m.give(A, river[10], 1);
    expect(await serveFish(m.store, A, { fish: river[10], way: "aquarium", idempotency_key: "tb-0598" })).toMatchObject({ ok: true, data: { earned: TASTING.marks[0].coins, marks: ["count:10"] } });
    // The cliff pools: all but one in the tank, the last cooked; the page is full, so the cook pays the water (round 4 pick).
    const cliff = tastingPages().find((p) => p.water === "cliff_pool")!.species;
    for (const [i, key] of cliff.slice(0, -1).entries()) { m.give(A, key, 1); await serveFish(m.store, A, { fish: key, way: "aquarium", idempotency_key: `tb-03${i}0` }); }
    m.give(A, cliff.at(-1)!, 1);
    expect(await serveFish(m.store, A, { fish: cliff.at(-1)!, way: "cook", idempotency_key: "tb-0399" })).toMatchObject({ ok: true, data: { paid: tastingFee(1), earned: TASTING.full, marks: ["water:cliff_pool"] } });
    expect(m.coinsOf(A)).toBe(1000 - tastingFee(0) + TASTING.marks[0].coins - tastingFee(1) + TASTING.full);
    expect(m.ledger.filter((l) => l.member === A && l.amount > 0 && l.source === "quest")).toHaveLength(2);
  });

  it("names every meal in the rod's six stats, small (round 3: \"chill out on the buff\"), and finds a buff's meal by its source", () => {
    const meals = [...SUSHI_MENU.map((d) => d.buff), ...TASTING.dishes.map((d) => d.buff), STAFF_MEAL];
    for (const b of meals) {
      const { minutes, ...stats } = b;
      expect(minutes).toBeGreaterThan(0);
      expect(Object.keys(stats).length).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(stats)) {
        expect(STAT_KEYS as readonly string[]).toContain(k);
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(0.12);
      }
    }
    expect(mealOf("staff_meal")?.buff).toBe(STAFF_MEAL);
    expect(mealOf("snapper_chazuke")).toMatchObject({ name: "Snapper chazuke", buff: TASTING.dishes[0].buff });
    expect(mealOf("omakase")?.buff).toBe(SUSHI_MENU.find((d) => d.id === "omakase")!.buff);
    expect(mealOf("gone")).toBeNull();
    // Each key fish is a rod fish with a slot (so it can go to the tank), and teaches one dish.
    for (const d of TASTING.dishes) expect(tastingWater(d.unlock)).not.toBeNull();
    expect(new Set(TASTING.dishes.map((d) => d.unlock)).size).toBe(TASTING.dishes.length);
  });
});
