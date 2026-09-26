import {
  createCenteredMap, setCell, Surface, heightField, sampleGroundHeight,
  worldToCellX, worldToCellZ, isGroundAtWorld, surfaceAt, levelAt, CLIFF_LEVELS,
} from "./grid";
import { studySolid } from "@/lib/study/seats";

/**
 * Default island: the village core (ledger rows 155, 156). World +x is screen
 * left from the follow camera, +z is north (up-screen). Landmarks reuse the
 * existing ACNH buildings/props; closed landmarks show a boarded, signed state.
 * Never reads or overwrites the authored island or browser drafts.
 */
export const DEFAULT_SPAWN: [number, number, number] = [0, 0, -10];
/** Island ellipse radii (world units): grass inside 0.85, sand to 1.0. */
export const ISLAND_RADII = { x: 24, z: 20 } as const;

export type LandmarkId = "hq" | "plaza" | "monument" | "mailbox" | "notice" | "catch" | "shop" | "cafe" | "oracle" | "museum" | "ruins" | "pond" | "wharf" | "beach";
export interface Landmark {
  id: LandmarkId; label: string; x: number; z: number;
  /** Open to visit now; closed landmarks are visible but boarded up. */
  open: boolean;
  /** Solid footprint half extents (axis aligned), if the landmark blocks walking. */
  half?: [number, number];
  /** Minimap marker colour. */
  color: string;
}

export const LANDMARKS: Landmark[] = [
  { id: "hq", label: "Clubhouse", x: 0, z: 9.35, open: true, half: [3.5, 2.65], color: "#5B4B9E" },
  { id: "plaza", label: "Plaza", x: -1.5, z: 3.5, open: true, color: "#C98F73" },
  { id: "monument", label: "Club monument", x: -5.2, z: 3.4, open: true, half: [1.1, 1.0], color: "#B79A5B" },
  { id: "mailbox", label: "Mailbox", x: -4.4, z: 6.3, open: true, half: [0.3, 0.3], color: "#C0463C" },
  { id: "notice", label: "Notice board", x: -2.6, z: 5.6, open: true, half: [0.75, 0.25], color: "#8A6A4A" },
  { id: "catch", label: "Catch board", x: 2.6, z: 5.6, open: true, half: [0.75, 0.25], color: "#3E7FA6" },
  { id: "shop", label: "Shop", x: 10, z: -6, open: true, half: [3.25, 1.8], color: "#2B4EA0" },
  { id: "cafe", label: "Café", x: -10, z: -6, open: false, half: [2.5, 2.1], color: "#C9A227" },
  { id: "oracle", label: "Oracle temple", x: -11, z: 9, open: true, half: [3.4, 1.7], color: "#2E8B8B" },
  { id: "museum", label: "Museum", x: 11, z: 9.6, open: false, half: [2.5, 2.1], color: "#9A4A3A" },
  { id: "ruins", label: "Ruins gate", x: 17.2, z: -2.5, open: false, half: [0.4, 1.6], color: "#6F6A62" },
  { id: "pond", label: "Pond", x: -9, z: 2.9, open: true, color: "#69A8D0" },
  { id: "beach", label: "Beach", x: 0, z: -18, open: true, color: "#E4CD96" },
  { id: "wharf", label: "Wharf", x: 8, z: -19.5, open: true, color: "#B98C60" },
];
export const landmark = (id: LandmarkId) => LANDMARKS.find(l => l.id === id)!;
export const POND = { x: -9, z: 2.9, r: 1.8 };
/** Wharf stub deck (walkable over the water). */
export const WHARF_DECK = { x0: 7.1, x1: 8.9, z0: -23, z1: -17.5 };

export const ISLAND_TREES: [number, number][] = [
  [-6, -12], [-15, -9], [14, -12], [17, -7], [-18, 2], [-16, -3], [18, 5], [15, 2],
  [-5, 12], [5, 13], [15, 8], [-16, 6], [6, -14], [-13, -13], [11, 3], [-4, -3],
];
export const ISLAND_BUSHES: [number, number][] = [
  [-5, -9], [6, -9.5], [-7.8, 6.6], [6.5, 6.5], [-14, -5], [14, -3], [-7, -1], [7, -1],
  [-12, 4.5], [8, 12], [-8, 13], [4, 2.2], [-3.5, -14], [3.5, -14], [18, -1], [-19, -1],
];
export const ISLAND_FLOWERS: [number, number][] = [
  [-5, -7], [5, -7], [3, -5], [-11, 1.5], [9, 6.5], [-5.8, 7.6], [4, 6.5], [-7, -3],
  [8, -2], [-15, -1.5], [13, 6], [-12, -11], [12, -10], [2, -15], [-2, -15], [-6, 9],
];

// Footprints use the measured world-scale GLB bounds, before rotation/scale.
export const ISLAND_PROPS = [
  { model: "bench-wood", x: -6, z: -8, scale: 1, yaw: 0, halfWidth: 0.98, halfDepth: 0.27 },
  { model: "bench-wood", x: 5, z: 4.5, scale: 1, yaw: Math.PI / 2, halfWidth: 0.98, halfDepth: 0.27 },
  { model: "rock-a", x: -19, z: -7, scale: 1.3, yaw: 0.4, halfWidth: 0.48, halfDepth: 0.45 },
  { model: "rock-b", x: -18, z: -8, scale: 0.8, yaw: -0.8, halfWidth: 0.46, halfDepth: 0.42 },
  { model: "rock-c", x: 18.5, z: 3.5, scale: 1.4, yaw: 0.2, halfWidth: 0.5, halfDepth: 0.5 },
  { model: "rock-a", x: -12.5, z: 3.5, scale: 0.7, yaw: 1, halfWidth: 0.48, halfDepth: 0.45 },
] as const;

/** Bench-wood seat top: its slats measure 0.48–0.51 above the ground. */
export const BENCH_SEAT_TOP = 0.5;
/** The village bench within reach, as a `tsi:sit` spot: its middle, facing the side you stand on. */
export function benchSeat(x: number, z: number, range = 1.3): { x: number; z: number; yaw: number } | null {
  const b = ISLAND_PROPS.find(p => p.model === "bench-wood" && Math.hypot(p.x - x, p.z - z) < range);
  if (!b) return null;
  const front = (x - b.x) * Math.sin(b.yaw) + (z - b.z) * Math.cos(b.yaw) >= 0;
  return { x: b.x, z: b.z, yaw: b.yaw + (front ? 0 : Math.PI) };
}

const inRect = (x: number, z: number, x0: number, x1: number, z0: number, z1: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

export function createDefaultIsland() {
  const map = createCenteredMap(64, 64);
  for (let z = 0; z < map.depth; z++) {
    for (let x = 0; x < map.width; x++) {
      const wx = x + map.originX, wz = z + map.originZ;
      const radius = Math.hypot(wx / ISLAND_RADII.x, wz / ISLAND_RADII.z);
      const land = radius < 0.85;
      let surface: number = land ? Surface.Grass : radius < 1 ? Surface.Sand : Surface.River;
      if (land) {
        // Main path spawn → clubhouse, the shop/café lane, the ruins track and the beach walk.
        if (Math.abs(wx) <= 1 && wz >= -16 && wz <= 6) surface = Surface.Soil;
        if (inRect(wx, wz, -12, 12, -10, -9)) surface = Surface.Soil;
        if (inRect(wx, wz, 1, 16, -3, -2)) surface = Surface.Soil;
        if (inRect(wx, wz, -11, -1, 5, 6) || inRect(wx, wz, -12, -10, 5, 7)) surface = Surface.Soil;
        // Plaza in front of the clubhouse, widened west for the club monument.
        if (inRect(wx, wz, -7, 4, 2, 5)) surface = Surface.Stone;
        if (Math.hypot(wx - POND.x, wz - POND.z) < POND.r) surface = Surface.River;
      }
      // The river crosses the island just south of the plaza; wooden bridge on the path.
      if (radius < 1 && wz >= 0 && wz <= 1) surface = Math.abs(wx) <= 1 ? Surface.Wood : Surface.River;
      // Oracle rise: a one-level (blended half step) plateau north-west.
      const level = radius < 0.82 && wx <= -6 && wz >= 6 ? 1 : 0;
      setCell(map, x, z, level, surface);
    }
  }
  const field = heightField(map);
  const ground = (x: number, z: number) => sampleGroundHeight(map, field, x, z);
  const surface = (x: number, z: number) => surfaceAt(map, worldToCellX(map, x), worldToCellZ(map, z));
  const standable = (x: number, z: number) => {
    if (inRect(x, z, WHARF_DECK.x0, WHARF_DECK.x1, WHARF_DECK.z0, WHARF_DECK.z1)) return true;
    if (!isGroundAtWorld(map, x, z)) return false;
    if (LANDMARKS.some(l => l.half && Math.abs(x - l.x) < l.half[0] && Math.abs(z - l.z) < l.half[1])) return false;
    if (ISLAND_PROPS.some((prop) => {
      const dx = x - prop.x, dz = z - prop.z;
      const localX = dx * Math.cos(prop.yaw) - dz * Math.sin(prop.yaw);
      const localZ = dx * Math.sin(prop.yaw) + dz * Math.cos(prop.yaw);
      return Math.abs(localX) < prop.halfWidth * prop.scale && Math.abs(localZ) < prop.halfDepth * prop.scale;
    })) return false;
    if (studySolid("village", x, z)) return false;
    return !ISLAND_TREES.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 0.65);
  };
  /** How much of the body (5 probe points) stands on free ground; 5 = fits. */
  const clearance = (x: number, z: number) =>
    [[0, 0], [-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]].filter(([dx, dz]) => standable(x + dx, z + dz)).length;
  const canStep = (x: number, z: number, nx: number, nz: number) => {
    // Never lose clearance: out in the open every step must fit; sitting on a bench leaves you inside
    // its footprint, and from there any step that frees as much or more of you walks you off it.
    if (clearance(nx, nz) < clearance(x, z)) return false;
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

/** Nearest landmark within `range` of a point (for proximity prompts and discovery). */
export function nearestLandmark(x: number, z: number, range: number, ids?: readonly LandmarkId[]): Landmark | null {
  let best: Landmark | null = null, distance = range;
  for (const l of LANDMARKS) {
    if (ids && !ids.includes(l.id)) continue;
    const d = Math.hypot(l.x - x, l.z - z);
    if (d < distance) { best = l; distance = d; }
  }
  return best;
}
