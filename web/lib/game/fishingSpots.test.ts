import { describe, expect, it } from "vitest";
import { fishingSpot, nearestWater, villageWaterType } from "./fishingSpots";
import { createDefaultIsland, ISLAND_RADII, POND } from "./defaultIsland";
import { createHomeIsland } from "./homeIsland";
import { isGroundAtWorld } from "./grid";

describe("fishing spots", () => {
  const island = createDefaultIsland();
  const classify = villageWaterType(ISLAND_RADII, POND);
  it("detects river, pond and sea from where the player stands", () => {
    expect(fishingSpot(island.map, classify, 5, -1.2)?.water).toBe("river");
    expect(fishingSpot(island.map, classify, POND.x + 2.4, POND.z)?.water).toBe("pond");
    expect(fishingSpot(island.map, classify, 3, -19)?.water).toBe("sea");
  });
  it("offers nothing inland and always lands the bobber on water", () => {
    expect(fishingSpot(island.map, classify, 0, -10)).toBeNull();
    expect(nearestWater(island.map, -4, 8)).toBeNull();
    let spots = 0;
    for (let x = -22; x <= 22; x += 1.5) for (let z = -19; z <= 19; z += 1.5) {
      if (!island.standable(x, z)) continue;
      const spot = fishingSpot(island.map, classify, x, z);
      if (!spot) continue;
      spots++;
      expect(isGroundAtWorld(island.map, ...spot.target), `${x},${z}`).toBe(false);
    }
    expect(spots).toBeGreaterThan(60);
  });
  it("treats every edge of the home island as sea", () => {
    const home = createHomeIsland();
    expect(fishingSpot(home.map, () => "sea", 0, -8.3)?.water).toBe("sea");
  });
});
