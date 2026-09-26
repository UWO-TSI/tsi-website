/**
 * Cast anywhere along shore, river and pond edges (decision 195): the nearest
 * water within reach decides the spot, and its water type decides the pool.
 * Water type is read from the island's own layout, not placed shadows.
 */
import { Surface, isGroundAtWorld, surfaceAt, worldToCellX, worldToCellZ, type IslandMap } from "./grid";

export type WaterType = "river" | "pond" | "sea";
export interface FishingSpot { target: [number, number]; water: WaterType }

/** Reach from the bank to the nearest water cell centre. */
export const CAST_REACH = 2.6;

export function nearestWater(map: IslandMap, x: number, z: number, reach = CAST_REACH): [number, number] | null {
  let best: [number, number] | null = null, bestD = reach;
  for (let dz = -Math.ceil(reach); dz <= Math.ceil(reach); dz++) for (let dx = -Math.ceil(reach); dx <= Math.ceil(reach); dx++) {
    const cx = Math.floor(x) + dx + 0.5, cz = Math.floor(z) + dz + 0.5;
    if (surfaceAt(map, worldToCellX(map, cx), worldToCellZ(map, cz)) !== Surface.River) continue;
    if (isGroundAtWorld(map, cx, cz)) continue;
    const d = Math.hypot(cx - x, cz - z);
    if (d < bestD) { bestD = d; best = [cx, cz]; }
  }
  return best;
}

/**
 * A spot for a player standing at (x, z), or null when no water is in reach.
 * The bobber lands a little past the nearest water cell, staying on water.
 */
export function fishingSpot(map: IslandMap, classify: (x: number, z: number) => WaterType, x: number, z: number): FishingSpot | null {
  const water = nearestWater(map, x, z);
  if (!water) return null;
  const d = Math.hypot(water[0] - x, water[1] - z) || 1;
  const out: [number, number] = [water[0] + (water[0] - x) / d * 0.9, water[1] + (water[1] - z) / d * 0.9];
  const target = isGroundAtWorld(map, ...out) ? water : out;
  return { target, water: classify(target[0], target[1]) };
}

/** Village classifier: sea outside the island ellipse, the pond by its disc, else the river. */
export function villageWaterType(radii: { x: number; z: number }, pond: { x: number; z: number; r: number }) {
  return (x: number, z: number): WaterType =>
    Math.hypot(x / radii.x, z / radii.z) >= 0.97 ? "sea" : Math.hypot(x - pond.x, z - pond.z) < pond.r + 0.8 ? "pond" : "river";
}
