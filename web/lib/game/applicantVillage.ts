import {
  createCenteredMap, setCell, Surface, heightField, sampleGroundHeight,
  worldToCellX, worldToCellZ, isGroundAtWorld, surfaceAt, levelAt, CLIFF_LEVELS,
} from "./grid";

// Shared by rendered furniture, lighting, interaction anchors and collision.
function hqPiece(position: [number, number, number], scale: number, rotY: number, footprint?: [number, number]) {
  return { position, scale, rotY, footprint };
}
export const HQ_LAYOUT = {
  board: hqPiece([0, 1.28, 5.78], 0.2, Math.PI),
  sofa: hqPiece([4.85, 0, 4.8], 0.16, Math.PI, [1.47, 0.72]),
  table: hqPiece([4.85, 0, 2.85], 0.12, 0, [1.08, 0.55]),
  loungeChair: hqPiece([6.55, 0, 1.15], 0.1, -0.45, [0.55, 0.55]),
  loungeLamp: hqPiece([6.8, 0, 4.8], 0.115, 0, [0.36, 0.36]),
  desk: hqPiece([-5.2, 0, -2.4], 0.11, Math.PI, [1.2, 0.65]),
  deskChair: hqPiece([-5.2, 0, -0.7], 0.1, Math.PI, [0.45, 0.45]),
  shelf: hqPiece([7.7, 0, -1.3], 0.1, Math.PI / 2, [0.25, 1]),
  display: hqPiece([-4.5, 0, 5.2], 0.1, Math.PI, [1.5, 0.65]),
  clock: hqPiece([-7, 0, 5.55], 0.1, Math.PI, [0.45, 0.4]),
  monstera: hqPiece([-7.2, 0, 3.2], 0.1, 0, [0.55, 0.5]),
  yucca: hqPiece([7.25, 0, -4], 0.1, 0, [0.55, 0.5]),
};
export const HQ_CLOCK = HQ_LAYOUT.clock.position;
export const HQ_BOARD_APPROACH: [number, number] = [HQ_LAYOUT.board.position[0], 4.3];
export const HQ_PENDANTS = [
  { position: [0, 4, 5.65] as [number, number, number], scale: 0.05, drop: 0.78, power: 0.35 },
  { position: [HQ_LAYOUT.table.position[0], 4, HQ_LAYOUT.table.position[2]] as [number, number, number], scale: 0.07, drop: 1.09, power: 0.4 },
];
export const APPLICANT_SPAWN: [number, number, number] = [0, 0, -7];
export const ISLAND_TREES: [number, number][] = [[-8, -6], [-12, 2], [9, -7], [12, 9], [-8, 8], [8, 11], [-11, -5], [9, 12], [-11, 6], [11, 3], [-6, 10], [5, 12], [-12, -2], [12, -5], [-5, -11], [6, -11]];
export const ISLAND_BUSHES: [number, number][] = [[-4, -9], [6, -8], [-8, 4], [5, 8], [-10, -5], [-7, -4], [10, 7], [11, 10], [-6, 1], [-8, 1.8], [7, -2], [8, 1], [-4, 8], [4, 10], [-9, -8], [9, -9], [-11, 4], [11, 5], [-5, -3], [5, -4], [-7, 9], [7, 10]];
export const ISLAND_FLOWERS: [number, number][] = [[-5, -7], [5, -7], [-8, 6], [9, 7], [-7, -2], [-10, -2], [5, 6.5], [7, 5.5], [-4, -4], [-5, 0], [4, -2], [5, 1], [-9, 2], [10, 3], [-5, 7], [4, 8], [-7, -10], [7, -9], [-10, 6], [10, 9]];

// Footprints use the measured world-scale GLB bounds, before rotation/scale.
export const ISLAND_PROPS = [
  { model: "bench-wood", x: -6, z: -7, scale: 1, yaw: 0, halfWidth: 0.98, halfDepth: 0.27 },
  { model: "bench-wood", x: 5, z: 4.5, scale: 1, yaw: Math.PI / 2, halfWidth: 0.98, halfDepth: 0.27 },
  { model: "rock-a", x: -15, z: -6, scale: 1.3, yaw: 0.4, halfWidth: 0.48, halfDepth: 0.45 },
  { model: "rock-b", x: -14, z: -7, scale: 0.8, yaw: -0.8, halfWidth: 0.46, halfDepth: 0.42 },
  { model: "rock-c", x: 14, z: -3, scale: 1.4, yaw: 0.2, halfWidth: 0.5, halfDepth: 0.5 },
  { model: "rock-a", x: 13.2, z: -4.2, scale: 0.7, yaw: 1, halfWidth: 0.48, halfDepth: 0.45 },
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
  return { map, ground, surface, standable, move, fishingTarget };
}


const HQ_FURNITURE = Object.values(HQ_LAYOUT).flatMap(piece => piece.footprint
  ? [[piece.position[0], piece.position[2], ...piece.footprint]] : []);
export function constrainApplicantHQ(x: number, z: number, nx: number, nz: number): [number, number] {
  const fits = (px: number, pz: number) => !HQ_FURNITURE.some(([cx, cz, w, d]) => Math.abs(px - cx) < w + 0.2 && Math.abs(pz - cz) < d + 0.2);
  const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.15));
  const dx = (nx - x) / steps, dz = (nz - z) / steps;
  for (let i = 0; i < steps; i++) {
    if (fits(x + dx, z + dz)) { x += dx; z += dz; }
    else if (fits(x + dx, z)) x += dx;
    else if (fits(x, z + dz)) z += dz;
    else break;
  }
  return [x, z];
}
