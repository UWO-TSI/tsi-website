import {
  createCenteredMap, setCell, Surface, heightField, sampleGroundHeight,
  worldToCellX, worldToCellZ, isGroundAtWorld, surfaceAt, levelAt, CLIFF_LEVELS,
} from "./grid";

export const DEFAULT_SPAWN: [number, number, number] = [0, 0, -10];
export const ISLAND_TREES: [number, number][] = [[-8, -6], [-13, 0], [10, -5], [12, 6], [-9, 8], [8, 11], [-11, -5], [14, 8]];
export const ISLAND_BUSHES: [number, number][] = [[-5, -9], [6, -8], [-10, 4], [6, 6], [-10, -5], [-7, -4], [10, 7], [13, 9]];
export const ISLAND_FLOWERS: [number, number][] = [[-5, -7], [5, -7], [-8, 6], [9, 7], [-7, -2], [-10, -2], [5, 6.5], [7, 5.5]];

// Footprints use the measured world-scale GLB bounds, before rotation/scale.
export const ISLAND_PROPS = [
  { model: "bench-wood", x: -10, z: -9, scale: 1, yaw: 0, halfWidth: 0.98, halfDepth: 0.27 },
  { model: "bench-wood", x: 5, z: 4.5, scale: 1, yaw: Math.PI / 2, halfWidth: 0.98, halfDepth: 0.27 },
  { model: "rock-a", x: -15, z: -6, scale: 1.3, yaw: 0.4, halfWidth: 0.48, halfDepth: 0.45 },
  { model: "rock-b", x: -14, z: -7, scale: 0.8, yaw: -0.8, halfWidth: 0.46, halfDepth: 0.42 },
  { model: "rock-c", x: 16, z: -3, scale: 1.4, yaw: 0.2, halfWidth: 0.5, halfDepth: 0.5 },
  { model: "rock-a", x: 15.2, z: -4.2, scale: 0.7, yaw: 1, halfWidth: 0.48, halfDepth: 0.45 },
] as const;

/** Small review fixture. Never reads or overwrites the authored island or browser drafts. */
export function createDefaultIsland() {
  const map = createCenteredMap(64, 64);
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const wx = x + map.originX, wz = z + map.originZ;
      const radius = Math.hypot(wx / 21, wz / 17);
      let surface: number = radius < 0.83 ? Surface.Grass : radius < 1 ? Surface.Sand : Surface.River;
      if (radius < 0.83 && Math.abs(wx) <= 1 && wz >= -11 && wz <= 6) surface = Surface.Soil;
      if (radius < 1 && wz >= 0 && wz <= 1) surface = Math.abs(wx) <= 1 ? Surface.Wood : Surface.River;
      const level = radius < 0.78 && wx < -6 && wz > 6 ? 1 : 0;
      setCell(map, x, z, level, surface);
    }
  }
  const field = heightField(map);
  const ground = (x: number, z: number) => sampleGroundHeight(map, field, x, z);
  const surface = (x: number, z: number) => surfaceAt(map, worldToCellX(map, x), worldToCellZ(map, z));
  const standable = (x: number, z: number) => {
    if (!isGroundAtWorld(map, x, z)) return false;
    if (x > -3.5 && x < 3.5 && z > 6.7 && z < 12) return false;
    if (ISLAND_PROPS.some((prop) => {
      const dx = x - prop.x, dz = z - prop.z;
      const localX = dx * Math.cos(prop.yaw) - dz * Math.sin(prop.yaw);
      const localZ = dx * Math.sin(prop.yaw) + dz * Math.cos(prop.yaw);
      return Math.abs(localX) < prop.halfWidth * prop.scale && Math.abs(localZ) < prop.halfDepth * prop.scale;
    })) return false;
    return !ISLAND_TREES.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 0.65);
  };
  const fits = (x: number, z: number) =>
    [[0, 0], [-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]].every(([dx, dz]) => standable(x + dx, z + dz));
  const canStep = (x: number, z: number, nx: number, nz: number) => {
    if (!fits(nx, nz)) return false;
    return Math.abs(levelAt(map, worldToCellX(map, nx), worldToCellZ(map, nz)) -
      levelAt(map, worldToCellX(map, x), worldToCellZ(map, z))) < CLIFF_LEVELS;
  };
  const move = (fromX: number, fromZ: number, toX: number, toZ: number): [number, number] => {
    const count = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / 0.15));
    const dx = (toX - fromX) / count, dz = (toZ - fromZ) / count;
    let x = fromX, z = fromZ;
    for (let i = 0; i < count; i++) {
      if (canStep(x, z, x + dx, z + dz)) { x += dx; z += dz; }
      else if (canStep(x, z, x + dx, z)) x += dx;
      else if (canStep(x, z, x, z + dz)) z += dz;
      else break;
    }
    return [x, z];
  };
  return { map, ground, surface, standable, move };
}
