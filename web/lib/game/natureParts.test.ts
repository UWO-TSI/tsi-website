import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { flowerParts, mushroomUrl } from "./natureParts";
import { LAUNCH_ROSTER } from "@/lib/collections/roster";

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
  it("gives every woods mushroom species its own forage model", () => {
    const pub = join(__dirname, "../../public");
    const species = LAUNCH_ROSTER.filter(s => s.sub === "mushroom");
    expect(species.length).toBeGreaterThan(0);
    for (const s of species) expect(existsSync(join(pub, mushroomUrl(s.key))), s.key).toBe(true);
  });
});
