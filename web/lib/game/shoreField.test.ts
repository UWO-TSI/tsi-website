import { describe, expect, it } from "vitest";
import { coastDistance, latticeAt, sampleShore, shoreSdf, terrainOf, type IslandMap } from "./grid";
import { village } from "./villageMap";
import { createHomeIsland } from "./homeIsland";

// Audit 2026-10 world item 13: grey stair-step teeth along every shoreline. The water's foam starts where the shore
// field crosses 0, and that field was a distance transform of a mask sampled four times a cell, so its waterline
// stepped up to a tenth of a cell off the drawn coast. Where the field said land over open water there was no foam,
// and the clear shallows over the bed showed through as grey notches between the foam.
describe("the shore field", () => {
  for (const [name, make] of [["village", () => village()], ["home island", () => createHomeIsland()]] as const) {
    it(`crosses 0 on the drawn coast (${name})`, () => {
      const { map } = make() as { map: IslandMap }, f = shoreSdf(map), { coast } = terrainOf(map);
      let worst = 0, checked = 0;
      for (let z = map.originZ; z < map.originZ + map.depth - 1; z += 0.07) for (let x = map.originX; x < map.originX + map.width - 1; x += 0.07) {
        const d = coastDistance(map, x, z);
        if (Math.abs(d) > 0.6) continue;
        checked++;
        // Positive in water, in cells: the coast's own signed distance, which is 0 on the drawn waterline.
        if (Math.abs(d) < 0.3) worst = Math.max(worst, Math.abs(sampleShore(f, x, z) + d));
        if (Math.abs(d) > 0.03) expect(Math.sign(sampleShore(f, x, z)), `${x.toFixed(2)},${z.toFixed(2)}`).toBe(latticeAt(map, coast, x, z) > 0 ? -1 : 1);
      }
      expect(checked).toBeGreaterThan(1000);
      expect(worst).toBeLessThan(0.05);
    });
  }
});
