import { describe, expect, it } from "vitest";
import { flowerParts } from "./natureParts";

/** The widest ACNH flower (the pansy) is 1.08 across at scale 1 (measured from the GLBs). */
const FLOWER_HALF = 0.55;

describe("nature parts", () => {
  it("keeps a flower cluster inside its one-unit tile, for every seed", () => {
    for (let seed = 0; seed < 64; seed++) {
      const parts = flowerParts(seed);
      expect(parts).toHaveLength(3);
      for (const p of parts) {
        expect(Math.abs(p.offset[0]) + FLOWER_HALF * p.scale).toBeLessThanOrEqual(0.5);
        expect(Math.abs(p.offset[2]) + FLOWER_HALF * p.scale).toBeLessThanOrEqual(0.5);
      }
      // Three different blooms, side by side, not stacked.
      expect(new Set(parts.map(p => p.offset[0])).size).toBe(3);
    }
  });
});
