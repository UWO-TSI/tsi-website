import {
  createCenteredMap, setCell, Surface, heightField, sampleGroundHeight,
  worldToCellX, worldToCellZ, inBounds, surfaceAt, levelAt, CLIFF_LEVELS,
} from "./grid";

export const DEFAULT_SPAWN: [number, number, number] = [0, 0, -10];
export const ISLAND_TREES: [number, number][] = [[-8, -6], [-13, 0], [10, -5], [12, 6], [-9, 8], [8, 11]];
export const ISLAND_BUSHES: [number, number][] = [[-5, -9], [6, -8], [-10, 4], [6, 6]];
export const ISLAND_FLOWERS: [number, number][] = [[-5, -7], [5, -7], [-8, 6], [9, 7]];

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
  const standable = (x: number, z: number) => {
    const cx = worldToCellX(map, x), cz = worldToCellZ(map, z);
    if (!inBounds(map, cx, cz)) return false;
    const surface = surfaceAt(map, cx, cz);
    if (surface === Surface.River || surface === Surface.Void) return false;
    if (x > -3.5 && x < 3.5 && z > 6.7 && z < 12) return false;
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
  return { map, ground, standable, move };
}
