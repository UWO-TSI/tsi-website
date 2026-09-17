import { coastDist } from "./coast";
import { inBounds, waterHeightAt, worldToCellX, worldToCellZ, type IslandMap } from "./grid";
import { OCEAN_WATER_Y, RIVER_WATER_Y } from "./waterLevels";

export function legacyFishingWaterHeight(x: number, z: number): number {
  return coastDist(x, z) > 47 ? OCEAN_WATER_Y : RIVER_WATER_Y;
}

/** Grid rivers follow their cell level; the legacy ocean remains outside this map. */
export function gridFishingWaterHeight(map: IslandMap, x: number, z: number): number {
  const cx = worldToCellX(map, x), cz = worldToCellZ(map, z);
  return inBounds(map, cx, cz) ? waterHeightAt(map, cx, cz) : OCEAN_WATER_Y;
}
