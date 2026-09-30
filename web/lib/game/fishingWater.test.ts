import { expect, it } from "vitest";
import { createCenteredMap, LEVEL_STEP, setCell, Surface, WATER_DROP } from "./grid";
import { gridFishingWaterHeight } from "./fishingWater";
import { OCEAN_WATER_Y } from "./waterLevels";

it("places effects on sea-level and raised grid water without changing the map", () => {
  const map = createCenteredMap(8, 8);
  setCell(map, 4, 4, 0, Surface.River);
  setCell(map, 5, 4, 2, Surface.River);
  const before = [...map.levels];
  expect(gridFishingWaterHeight(map, 0, 0)).toBeCloseTo(-WATER_DROP);
  expect(gridFishingWaterHeight(map, 1.2, 0.1)).toBeCloseTo(2 * LEVEL_STEP - WATER_DROP);
  expect([...map.levels]).toEqual(before);
});

it("uses the surrounding ocean outside the grid rectangle", () => {
  const map = createCenteredMap(8, 8);
  for (const [x, z] of [[-4.6, 0], [3.6, 0], [0, -4.6], [0, 3.6]]) {
    expect(gridFishingWaterHeight(map, x, z)).toBe(OCEAN_WATER_Y);
  }
});
