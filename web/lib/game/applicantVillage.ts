import {
  createCenteredMap, setCell, Surface, heightField, sampleGroundHeight,
  worldToCellX, worldToCellZ, isGroundAtWorld, surfaceAt,
} from "./grid";
import { standWorld } from "./movement/sim";
import { TREE_TRUNK, inFootprint, propFootprint } from "./defaultIsland";

export const APPLICANT_SPAWN: [number, number, number] = [0, 0, -7];
export const ISLAND_TREES: [number, number][] = [[-8, -6], [-12, 2], [9, -7], [12, 9], [-8, 8], [8, 11], [-11, -5], [9, 12], [-11, 6], [11, 3], [-6, 10], [5, 12], [-12, -2], [12, -5], [-5, -11], [6, -11]];
export const ISLAND_BUSHES: [number, number][] = [[-4, -9], [6, -8], [-8, 4], [5, 8], [-10, -5], [-7, -4], [10, 7], [11, 10], [-6, 1], [-8, 1.8], [7, -2], [8, 1], [-4, 8], [4, 10], [-9, -8], [9, -9], [-11, 4], [11, 5], [-5, -3], [5, -4], [-7, 9], [7, 10]];
export const ISLAND_FLOWERS: [number, number][] = [[-5, -7], [5, -7], [-8, 6], [9, 7], [-7, -2], [-10, -2], [5, 6.5], [7, 5.5], [-4, -4], [-5, 0], [4, -2], [5, 1], [-9, 2], [10, 3], [-5, 7], [4, 8], [-7, -10], [7, -9], [-10, 6], [10, 9]];

// Footprints are the village props' (PROP_FOOTPRINT: measured GLB bounds, before rotation/scale).
export const ISLAND_PROPS = [
  { model: "bench-wood", x: -6, z: -7, scale: 1, yaw: 0 },
  { model: "bench-wood", x: 5, z: 4.5, scale: 1, yaw: Math.PI / 2 },
  { model: "rock-a", x: -15, z: -6, scale: 1.3, yaw: 0.4 },
  { model: "rock-b", x: -14, z: -7, scale: 0.8, yaw: -0.8 },
  { model: "rock-c", x: 14, z: -3, scale: 1.4, yaw: 0.2 },
  { model: "rock-a", x: 13.2, z: -4.2, scale: 0.7, yaw: 1 },
] as const;

/** Recruitment layout using the member game terrain. No saved map or member state. */
export function createApplicantVillage() {
  const map = createCenteredMap(40, 40);
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const wx = x + map.originX, wz = z + map.originZ;
      const radius = Math.hypot(wx / 17, wz / 16);
      let surface: number = radius < 0.85 ? Surface.Grass : radius < 1 ? Surface.Sand : Surface.River;
      if (radius < 0.85 && Math.abs(wx) <= 1 && wz >= -10 && wz <= 7) surface = Surface.Soil;
      if (radius < 0.85 && wz >= 4 && wz <= 6 && wx >= -7 && wx <= 10) surface = Surface.Soil;
      if (radius < 0.85 && wz >= -7 && wz <= -5 && wx >= -7 && wx <= 1) surface = Surface.Soil;
      if (radius < 0.85 && wx >= -14 && wx <= -1 && Math.abs(wz) <= 0.5) surface = Surface.Soil;
      const level = 0;
      setCell(map, x, z, level, surface);
    }
  }
  const field = heightField(map);
  const ground = (x: number, z: number) => sampleGroundHeight(map, field, x, z);
  const surface = (x: number, z: number) => surfaceAt(map, worldToCellX(map, x), worldToCellZ(map, z));
  const standable = (x: number, z: number) => {
    if (!isGroundAtWorld(map, x, z)) return false;
    if (x > -3.5 && x < 3.5 && z > 6.7 && z < 12) return false;
    if (ISLAND_PROPS.some((prop) => { const [hw, hd] = propFootprint(prop)!; return inFootprint(x, z, prop, prop.yaw, hw, hd); })) return false;
    return !ISLAND_TREES.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < TREE_TRUNK);
  };
  // Water-side shoreline cells, derived from the same terrain the player sees.
  const shore: [number, number][] = [];
  for (let z = 1; z < map.depth - 1; z++) for (let x = 1; x < map.width - 1; x++) {
    if (surfaceAt(map, x, z) !== Surface.River) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => surfaceAt(map, x + dx, z + dz) !== Surface.River)) {
      shore.push([x + map.originX, z + map.originZ]);
    }
  }
  const fishingTarget = (x: number, z: number): [number, number] | null => {
    if (!standable(x, z)) return null;
    let closest: [number, number] | null = null, distance = 3;
    for (const spot of shore) {
      const d = Math.hypot(spot[0] - x, spot[1] - z);
      if (d < distance) { closest = spot; distance = d; }
    }
    if (!closest) return null;
    const dx = (closest[0] - x) / distance, dz = (closest[1] - z) / distance;
    const target: [number, number] = [closest[0] + dx * 1.5, closest[1] + dz * 1.5];
    return isGroundAtWorld(map, ...target) ? closest : target;
  };
  return { map, ground, surface, standable, fishingTarget, ...standWorld(ground, standable, (x, z) => !isGroundAtWorld(map, x, z)) };
}
