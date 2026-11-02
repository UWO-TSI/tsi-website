import { describe, expect, it } from "vitest";
import { TASTING } from "./catalogue";
import { memoryEconomyStore } from "./memoryStore";
import { tastingMarks, tastingPages, tastingWater } from "./rules";
import { serveFish, tastingView } from "./service";
import { ROSTER } from "@/lib/collections/roster";

const A = "00000000-0000-4000-8000-0000000000aa";
const B = "00000000-0000-4000-8000-0000000000bb";
const noon = new Date("2026-11-01T16:00:00Z");

describe("the tasting book (David, 2026-11-01: \"one per fish ... meal that gets buff and a stamp or in the aquarium\")", () => {
  it("has a page per water and a slot for every species a rod brings in, once", () => {
    const pages = tastingPages();
    expect(pages.map((p) => p.water)).toEqual(["river", "sea", "pond", "cliff_pool"]);
    const slots = pages.flatMap((p) => p.species);
    expect(new Set(slots).size).toBe(slots.length);
    expect(slots.sort()).toEqual(ROSTER.filter((s) => s.tool === "rod").map((s) => s.key).sort());
    expect(tastingWater("fish_dace")).toBe("river");
    expect(tastingWater("bug_ladybug")).toBeNull();
  });

  it("cooks a fish for the fee and the buff, stamping its slot the first time only", async () => {
    const m = memoryEconomyStore();
    m.fund(A, 100);
    m.give(A, "fish_dace", 2);
    const serve = (key: string, way: "cook" | "aquarium" = "cook", fish = "fish_dace") => serveFish(m.store, A, { fish, way, idempotency_key: key }, noon);
    expect(await serve("tb-0001")).toMatchObject({ ok: true, data: { paid: TASTING.dish.price, stamped: true, remaining: 1, earned: 0 } });
    expect(m.coinsOf(A)).toBe(100 - TASTING.dish.price);
    expect(await m.store.buff(A, noon)).toMatchObject({ source: "tasting", luck: TASTING.dish.buff.luck, size: TASTING.dish.buff.size });
    expect(await serve("tb-0001")).toMatchObject({ ok: true, data: { replayed: true, stamped: true } });
    expect(m.coinsOf(A)).toBe(100 - TASTING.dish.price);
    expect(await serve("tb-0002")).toMatchObject({ ok: true, data: { stamped: false, remaining: 0 } });
    expect(await serve("tb-0003")).toMatchObject({ ok: false, code: "insufficient_items" });
    expect(await tastingView(m.store, A)).toMatchObject({ ok: true, data: { book: [{ species_key: "fish_dace", way: "cooked" }], aquarium: [] } });
  });

  it("gives a fish to the club's aquarium for free, only into an empty slot", async () => {
    const m = memoryEconomyStore();
    m.give(A, "fish_pike", 2);
    m.give(B, "fish_tuna", 1);
    const serve = (who: string, fish: string, key: string) => serveFish(m.store, who, { fish, way: "aquarium", idempotency_key: key }, noon);
    expect(await serve(A, "fish_pike", "tb-0101")).toMatchObject({ ok: true, data: { paid: 0, stamped: false, remaining: 1 } });
    expect(await m.store.buff(A, noon)).toBeNull();
    expect(await serve(A, "fish_pike", "tb-0102")).toMatchObject({ ok: false, code: "already_in_book" });
    await serve(B, "fish_tuna", "tb-0103");
    // The tank is the club's: everyone's gifts, newest first.
    expect(await tastingView(m.store, A)).toMatchObject({ ok: true, data: { book: [{ species_key: "fish_pike", way: "aquarium" }], aquarium: ["fish_tuna", "fish_pike"] } });
    expect(await serveFish(m.store, A, { fish: "bug_ladybug", way: "cook", idempotency_key: "tb-0104" }, noon)).toMatchObject({ ok: false, code: "not_found" });
  });

  it("refuses a locked fish and a cook it can't pay for, keeping the fish", async () => {
    const m = memoryEconomyStore();
    m.give(A, "fish_pike", 1);
    expect(await serveFish(m.store, A, { fish: "fish_pike", way: "cook", idempotency_key: "tb-0201" }, noon)).toMatchObject({ ok: false, code: "insufficient" });
    m.lock(A, "fish_pike", true);
    expect(await serveFish(m.store, A, { fish: "fish_pike", way: "aquarium", idempotency_key: "tb-0202" }, noon)).toMatchObject({ ok: false, code: "locked" });
    expect((await m.store.collections(A))[0].count).toBe(1);
  });

  it("pays the marks and a full water once, as the slots fill", async () => {
    expect(tastingMarks(new Set(Array.from({ length: 10 }, (_, i) => `x${i}`)), "x0")).toEqual({ earned: TASTING.marks[0].coins, marks: ["count:10"] });
    const m = memoryEconomyStore();
    const cliff = tastingPages().find((p) => p.water === "cliff_pool")!.species;
    let last = null;
    for (const [i, key] of cliff.entries()) {
      m.give(A, key, 1);
      last = await serveFish(m.store, A, { fish: key, way: "aquarium", idempotency_key: `tb-03${i}0` }, noon);
    }
    expect(last).toMatchObject({ ok: true, data: { earned: TASTING.full, marks: ["water:cliff_pool"] } });
    expect(m.coinsOf(A)).toBe(TASTING.full);
    expect(m.ledger.find((l) => l.member === A)?.source).toBe("quest");
  });
});
