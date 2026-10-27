import { describe, expect, it } from "vitest";
import { ROSTER } from "@/lib/collections/roster";
import { closedNow, outNow } from "./CatchBoard";

const pond = new Set(ROSTER.filter(s => s.biome === "pond").map(s => s.key));

describe("the tackle shop's catch board (d-now)", () => {
  it("never shows a pond fish as catchable on an island whose pond is closed, and lists them as closed instead", () => {
    let closedSeen = 0;
    for (const month of [1, 4, 7, 10]) for (let hour = 0.5; hour < 24; hour += 3) {
      expect(outNow(["sea", "river"], hour, month, "clear").some(o => pond.has(o.fish.key))).toBe(false);
      const shut = closedNow(["sea", "river"], hour, month, "clear");
      expect(shut.every(o => pond.has(o.fish.key))).toBe(true);
      closedSeen += shut.length;
      expect(closedNow(["sea", "river", "pond"], hour, month, "clear")).toEqual([]);
    }
    expect(closedSeen).toBeGreaterThan(0);
  });
});
