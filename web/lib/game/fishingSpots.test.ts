import { describe, expect, it } from "vitest";
import { classifyWater, fishingSpot, nearestWater, waterClassifier, villageWater, WATER_CLASS } from "./fishingSpots";
import { islandOf, landmark, villageIsland } from "./defaultIsland";
import { createHomeIsland } from "./homeIsland";
import { createCenteredMap, isGroundAtWorld, setCell, Surface } from "./grid";
import { buildVillage, village, type VillageDoc } from "./villageMap";
import frozen from "./fixtures/village-2026-09-28.json";

describe("fishing spots (frozen 2026-09-28 village)", () => {
  const v0 = buildVillage(frozen as VillageDoc), island = islandOf(v0);
  const { classify } = villageWater(v0);
  const pond = landmark("pond", v0)!;
  it("detects river, pond and sea from where the player stands", () => {
    expect(fishingSpot(island.map, classify, 5, -1.2)?.water).toBe("river");
    expect(fishingSpot(island.map, classify, pond.x + 2.4, pond.z)?.water).toBe("pond");
    expect(fishingSpot(island.map, classify, 3, -19)?.water).toBe("sea");
  });
  it("offers nothing inland", () => {
    expect(fishingSpot(island.map, classify, 0, -10)).toBeNull();
    expect(nearestWater(island.map, -4, 8)).toBeNull();
  });
  it("treats every edge of the home island as sea", () => {
    const home = createHomeIsland();
    expect(fishingSpot(home.map, () => "sea", 0, -8.3)?.water).toBe("sea");
  });
});

describe("water classes come from connectivity, not a shape", () => {
  // 20×20 sea; a 12×12 island with a 2-wide river crossing it to the sea on both sides and a pond inside.
  const map = createCenteredMap(20, 20);
  for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) setCell(map, x, z, 0, Surface.River);
  for (let z = 4; z < 16; z++) for (let x = 4; x < 16; x++) setCell(map, x, z, 0, Surface.Grass);
  for (let x = 4; x < 16; x++) { setCell(map, x, 9, 0, Surface.River); setCell(map, x, 10, 0, Surface.River); }
  for (let z = 5; z < 7; z++) for (let x = 6; x < 8; x++) setCell(map, x, z, 0, Surface.River);
  // A 3×3 pond opening onto the river's north bank, found from its marker.
  for (let z = 11; z < 14; z++) for (let x = 11; x < 14; x++) setCell(map, x, z, 0, Surface.River);
  const c = classifyWater(map, [[12 - 10, 12 - 10]]), at = (x: number, z: number) => c[z * 20 + x];
  it("sea around, river across, pond enclosed", () => {
    expect(at(0, 0)).toBe(WATER_CLASS.sea);
    expect(at(10, 9)).toBe(WATER_CLASS.river);
    expect(at(6, 5)).toBe(WATER_CLASS.pond);
    expect([at(11, 11), at(12, 12), at(13, 13)]).toEqual([WATER_CLASS.pond, WATER_CLASS.pond, WATER_CLASS.pond]);
    expect([at(5, 10), at(8, 9)]).toEqual([WATER_CLASS.river, WATER_CLASS.river]);
    expect(at(10, 12)).toBe(WATER_CLASS.land);
    // The shore ring is sea, grown back from the open water.
    expect(at(10, 3)).toBe(WATER_CLASS.sea);
    // Void (a legacy painted sea) is water too.
    setCell(map, 0, 0, 0, Surface.Void);
    expect(classifyWater(map)[0]).toBe(WATER_CLASS.sea);
    expect(waterClassifier(map)(50, 50)).toBe("sea");
  });
});

describe("fishing on the live village map", () => {
  const island = villageIsland(), { classify } = villageWater(), { bounds: b } = village();
  it("always lands the bobber on water", () => {
    let spots = 0;
    for (let x = b.minX; x <= b.maxX; x += 1.5) for (let z = b.minZ; z <= b.maxZ; z += 1.5) {
      if (!island.standable(x, z)) continue;
      const spot = fishingSpot(island.map, classify, x, z);
      if (!spot) continue;
      spots++;
      expect(isGroundAtWorld(island.map, ...spot.target), `${x},${z}`).toBe(false);
    }
    expect(spots).toBeGreaterThan(0);
  });
});
