import {
  CLIFF_LEVELS, isGroundAtWorld, levelAt, rampRun, sampleGroundHeight, surfaceAt, worldToCellX, worldToCellZ,
} from "./grid";
import { FURNITURE, studySolid, type Furniture } from "@/lib/study/seats";
import { objectsOf, village, villageSpawnPoint, type MapObject, type Village } from "./villageMap";

/**
 * Default island: the village core (ledger rows 155, 156), loaded from the
 * painted map file (`web/data/village-map.json`, lib/game/villageMap.ts; rows
 * 241, 246). Compass (row 239): the follow camera looks +z, which is west
 * (up-screen); +x, screen left, is south. A compass azimuth A (from north,
 * clockwise) is the world direction (x, z) = (−cos A, −sin A), so north is −x
 * and east is −z (toward the viewer).
 *
 * The file says WHERE things are; this module says WHAT they are: each
 * landmark's label, footprint and door, each prop model's footprint. Doors,
 * exits and the wharf's deck, boat and arrival point are offsets from their
 * landmark, so moving a building in the painter moves its door with it.
 */

export type LandmarkId = "hq" | "plaza" | "monument" | "mailbox" | "notice" | "catch" | "shop" | "cafe" | "oracle" | "museum" | "ruins" | "pond" | "wharf" | "beach";
export interface Landmark {
  id: LandmarkId; label: string; x: number; z: number;
  /** Open to visit now; closed landmarks are visible but boarded up. */
  open: boolean;
  /** Solid footprint half extents (axis aligned), if the landmark blocks walking. */
  half?: [number, number];
  /** Minimap marker colour. */
  color: string;
  /** Radians about +y (the wharf only; buildings face the camera). */
  yaw?: number;
}

interface LandmarkInfo extends Omit<Landmark, "id" | "x" | "z" | "yaw"> {
  /** Door or prompt point, relative to the landmark (before yaw). */
  door?: [number, number];
  /** Where you stand after coming back out (or arriving), relative. */
  exit?: [number, number];
}

/** What each landmark is. Order is the minimap and prompt order. */
export const LANDMARK_INFO: Record<LandmarkId, LandmarkInfo> = {
  hq: { label: "Clubhouse", open: true, half: [3.5, 2.65], color: "#5B4B9E", door: [0, -3.05], exit: [0, -3.95] },
  plaza: { label: "Plaza", open: true, color: "#C98F73" },
  monument: { label: "Club monument", open: true, half: [1.1, 1.0], color: "#B79A5B" },
  mailbox: { label: "Mailbox", open: true, half: [0.3, 0.3], color: "#C0463C" },
  notice: { label: "Notice board", open: true, half: [0.75, 0.25], color: "#8A6A4A" },
  catch: { label: "Catch board", open: true, half: [0.75, 0.25], color: "#3E7FA6" },
  shop: { label: "Shop", open: true, half: [3.25, 1.8], color: "#2B4EA0" },
  cafe: { label: "Café", open: false, half: [2.5, 2.1], color: "#C9A227", exit: [0, -2.9] },
  oracle: { label: "Oracle temple", open: true, half: [3.4, 1.7], color: "#2E8B8B", door: [0, -2.2], exit: [0, -3.1] },
  museum: { label: "Museum", open: false, half: [2.5, 2.1], color: "#9A4A3A", exit: [0, -3] },
  ruins: { label: "Ruins gate", open: false, half: [0.4, 1.6], color: "#6F6A62", exit: [-1.6, 0] },
  pond: { label: "Pond", open: true, color: "#69A8D0" },
  beach: { label: "Beach", open: true, color: "#E4CD96" },
  // Boat home at the stub end (specs/homes.md §1); you arrive a little inland.
  wharf: { label: "Wharf", open: true, color: "#B98C60", door: [0, -2.5], exit: [0, 1.1] },
};
export const LANDMARK_IDS = Object.keys(LANDMARK_INFO) as LandmarkId[];

/** Wharf stub deck (walkable over the water), relative to the wharf before its yaw. */
export const WHARF_DECK_LOCAL = { x0: -0.9, x1: 0.9, z0: -3.5, z1: 2 };
/** Wooden bridge deck, relative, before its yaw: the model spans ±1.9 along x, ±1.45 across with rails. */
export const BRIDGE_DECK_HALF: [number, number] = [1.9, 1.2];
/** Solid footprints (half width, half depth, before rotation and scale), from the measured GLB bounds. */
export const PROP_FOOTPRINT: Record<string, [number, number]> = {
  "bench-wood": [0.98, 0.27], "rock-a": [0.48, 0.45], "rock-b": [0.46, 0.42], "rock-c": [0.5, 0.5],
  "fence-country-a": [0.5, 0.16], "fence-country-b": [0.5, 0.16],
};
/** Prop tops before scale, measured from the GLB bounds: what a jump clears or lands on (lib/game/movement). */
export const PROP_TOP: Record<string, number> = {
  "bench-wood": 0.51, "rock-a": 0.61, "rock-b": 0.59, "rock-c": 0.52, "fence-country-a": 0.7, "fence-country-b": 0.69,
};
/** A tree trunk blocks this far from its centre. */
export const TREE_TRUNK = 0.65;
export const TREE_SEEDS = [0, 3, 2, 5, 7, 8, 1, 3];
/** A tree's seed picks one of the season's TREE_SLOTS models (SEASON_TREES); slot 3 is the cedar (no fruit, any turn). */
export const TREE_SLOTS = 4;
export const isCedar = (seed: number) => seed % TREE_SLOTS === 3;

export const turn = (dx: number, dz: number, yaw = 0): [number, number] =>
  yaw ? [dx * Math.cos(yaw) + dz * Math.sin(yaw), -dx * Math.sin(yaw) + dz * Math.cos(yaw)] : [dx, dz];

/** Landmarks placed on the map, in the table's order. */
export function landmarks(v: Village = village()): Landmark[] {
  const placed = new Map(objectsOf("landmark", v).map(o => [o.id, o]));
  return LANDMARK_IDS.flatMap((id) => {
    const o = placed.get(id);
    if (!o) return [];
    const { door: _door, exit: _exit, ...info } = LANDMARK_INFO[id];
    void _door; void _exit;
    return [{ id, x: o.x, z: o.z, ...info, ...(o.yaw ? { yaw: o.yaw } : {}) }];
  });
}
export const landmark = (id: LandmarkId, v: Village = village()): Landmark | null => landmarks(v).find(l => l.id === id) ?? null;

/** A landmark's door (or prompt) or exit point in world XZ, or null when it has none or is not placed. */
export function landmarkPoint(id: LandmarkId, which: "door" | "exit", v: Village = village()): [number, number] | null {
  const l = landmark(id, v), offset = LANDMARK_INFO[id][which];
  if (!l || !offset) return null;
  const [dx, dz] = turn(offset[0], offset[1], l.yaw);
  return [l.x + dx, l.z + dz];
}

/** Axis-aligned rect of a local rect turned by `yaw` (quarter turns stay exact). */
function turnedRect(x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }, yaw = 0) {
  const pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].map(([a, b]) => turn(a, b, yaw));
  const xs = pts.map(p => Math.round((x + p[0]) * 1e6) / 1e6), zs = pts.map(p => Math.round((z + p[1]) * 1e6) / 1e6);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

/** The wharf's walkable deck in world XZ, or null without a wharf. */
export function wharfDeck(v: Village = village()) {
  const w = landmark("wharf", v);
  return w ? turnedRect(w.x, w.z, WHARF_DECK_LOCAL, w.yaw) : null;
}

/** Walkable bridge decks in world XZ. */
export function bridgeDecks(v: Village = village()) {
  const [a, b] = BRIDGE_DECK_HALF;
  return objectsOf("bridge", v).map(o => turnedRect(o.x, o.z, { x0: -a, x1: a, z0: -b, z1: b }, o.yaw));
}

/** Where a fresh visit starts. */
export function villageSpawn(v: Village = village()): [number, number, number] {
  const [x, z] = villageSpawnPoint(v);
  return [x, 0, z];
}

/** The benches, rocks and fences: the props with a solid footprint. */
export const propsOf = (v: Village = village()) => [...objectsOf("bench", v), ...objectsOf("rock", v), ...objectsOf("fence", v)];

/** Solid footprint of a bench, rock or fence: half extents × scale (before its yaw). */
export function propFootprint(o: Pick<MapObject, "model" | "scale">): [number, number] | null {
  const f = o.model ? PROP_FOOTPRINT[o.model] : undefined;
  return f ? [f[0] * (o.scale ?? 1), f[1] * (o.scale ?? 1)] : null;
}

/** Whether (x, z) is inside half extents hw × hd around `at`, turned by `yaw`. */
export function inFootprint(x: number, z: number, at: { x: number; z: number }, yaw: number, hw: number, hd: number): boolean {
  const dx = x - at.x, dz = z - at.z;
  return Math.abs(dx * Math.cos(yaw) - dz * Math.sin(yaw)) < hw && Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw)) < hd;
}

/**
 * An object's footprint in its own frame (before its yaw): half extents and centre offset; null = a point.
 * Buildings, the wharf deck, bridges, study furniture and props. The painter draws and picks with it;
 * the health check's overlap warnings test it.
 */
export function objectFootprint(o: MapObject): { hw: number; hd: number; cx: number; cz: number } | null {
  if (o.kind === "landmark") {
    const d = WHARF_DECK_LOCAL, half = LANDMARK_INFO[o.id as LandmarkId]?.half;
    if (o.id === "wharf") return { hw: (d.x1 - d.x0) / 2, hd: (d.z1 - d.z0) / 2, cx: (d.x0 + d.x1) / 2, cz: (d.z0 + d.z1) / 2 };
    return half ? { hw: half[0], hd: half[1], cx: 0, cz: 0 } : null;
  }
  if (o.kind === "bridge") return { hw: BRIDGE_DECK_HALF[0], hd: BRIDGE_DECK_HALF[1], cx: 0, cz: 0 };
  if (o.kind === "study" && o.model && o.model in FURNITURE) {
    const [cx, cz, hw, hd] = FURNITURE[o.model as Furniture].solid[0];
    return { hw, hd, cx, cz };
  }
  const f = propFootprint(o);
  return f ? { hw: f[0], hd: f[1], cx: 0, cz: 0 } : null;
}

/** Bench-wood seat top: its slats measure 0.48–0.51 above the ground. */
export const BENCH_SEAT_TOP = 0.5;
/** The village bench within reach, as a `tsi:sit` spot: its middle, facing the side you stand on. `benches`: the village's, when the caller holds them (every frame). */
export function benchSeat(x: number, z: number, range = 1.3, v: Village = village(), benches: readonly MapObject[] = objectsOf("bench", v)): { x: number; z: number; yaw: number } | null {
  const b = benches.find(p => Math.hypot(p.x - x, p.z - z) < range);
  if (!b) return null;
  const yaw = b.yaw ?? 0;
  const front = (x - b.x) * Math.sin(yaw) + (z - b.z) * Math.cos(yaw) >= 0;
  return { x: b.x, z: b.z, yaw: yaw + (front ? 0 : Math.PI) };
}

export const inRect = (x: number, z: number, r: { x0: number; x1: number; z0: number; z1: number }) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
/** The body's footprint: 5 probe points, the centre and 0.2 out along each axis. */
export const PROBE: readonly (readonly [number, number])[] = [[0, 0], [-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]];
const NONE: readonly never[] = [];

/**
 * Solid footprints of the running seasonal event's decorations (world XZ),
 * blocked like buildings. Not map objects: SeasonalEvents.tsx sets them while
 * an event is up and clears them when it comes down.
 */
export const eventSolids: { x0: number; x1: number; z0: number; z1: number }[] = [];

export interface VillageIsland {
  map: Village["map"];
  ground: (x: number, z: number) => number;
  surface: (x: number, z: number) => number;
  standable: (x: number, z: number) => boolean;
  move: (fromX: number, fromZ: number, toX: number, toZ: number) => [number, number];
  /** Water with no land or deck (lib/game/movement's `wet`). */
  wet: (x: number, z: number) => boolean;
  /** The highest thing at a point: ground, a prop's top, Infinity for a building, trunk or study furniture (movement's `top`). */
  top: (x: number, z: number) => number;
}

/** Walking on a village: ground height, solids and the stepping rule, from its map and objects. */
export function islandOf(v: Village): VillageIsland {
  const { map, field } = v;
  const ground = (x: number, z: number) => sampleGroundHeight(map, field, x, z);
  const surface = (x: number, z: number) => surfaceAt(map, worldToCellX(map, x), worldToCellZ(map, z));
  const decks = [wharfDeck(v), ...bridgeDecks(v)].filter(d => d !== null);
  const solids = landmarks(v).filter(l => l.half);
  const props = propsOf(v).flatMap(o => {
    const f = propFootprint(o);
    return f ? [{ x: o.x, z: o.z, yaw: o.yaw ?? 0, hw: f[0], hd: f[1], top: (PROP_TOP[o.model!] ?? Infinity) * (o.scale ?? 1) }] : [];
  });
  // Trees and props by 4-unit bucket (numeric keys), so a painted island with hundreds of them walks as cheaply as a small one.
  const buckets = <T extends { x: number; z: number }>(items: readonly T[]) => {
    const grid = new Map<number, T[]>();
    for (const it of items) {
      const k = Math.floor(it.x / 4) * 4096 + Math.floor(it.z / 4), b = grid.get(k);
      if (b) b.push(it); else grid.set(k, [it]);
    }
    return grid;
  };
  const propGrid = buckets(props), treeGrid = buckets(objectsOf("tree", v));
  const onDeck = (x: number, z: number) => decks.some(d => inRect(x, z, d));
  const wet = (x: number, z: number) => !onDeck(x, z) && !isGroundAtWorld(map, x, z);
  /** Top of the solid at a point: a prop's measured top, Infinity for buildings, study furniture and trunks, -Infinity for none. */
  const solidTop = (x: number, z: number) => {
    if (solids.some(l => Math.abs(x - l.x) < l.half![0] && Math.abs(z - l.z) < l.half![1]) || eventSolids.some(r => inRect(x, z, r))) return Infinity;
    let top = -Infinity, trunk = false;
    const bx = Math.floor(x / 4), bz = Math.floor(z / 4);
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const k = (bx + ox) * 4096 + bz + oz;
      for (const p of propGrid.get(k) ?? NONE) if (inFootprint(x, z, p, p.yaw, p.hw, p.hd)) top = Math.max(top, p.top);
      for (const t of treeGrid.get(k) ?? NONE) if (Math.hypot(t.x - x, t.z - z) < TREE_TRUNK) trunk = true;
    }
    if (top === Infinity || studySolid("village", x, z, 0, v)) return Infinity;
    return trunk ? Infinity : top;
  };
  const standable = (x: number, z: number) => onDeck(x, z) || (!wet(x, z) && solidTop(x, z) === -Infinity);
  /** How much of the body (5 probe points) stands on free ground; 5 = fits. */
  const clearance = (x: number, z: number) => {
    let n = 0;
    for (const [dx, dz] of PROBE) if (standable(x + dx, z + dz)) n++;
    return n;
  };
  const canStep = (x: number, z: number, nx: number, nz: number) => {
    // Never lose clearance: out in the open every step must fit; sitting on a bench leaves you inside
    // its footprint, and from there any step that frees as much or more of you walks you off it.
    if (clearance(nx, nz) < clearance(x, z)) return false;
    const cx = worldToCellX(map, x), cz = worldToCellZ(map, z), ncx = worldToCellX(map, nx), ncz = worldToCellZ(map, nz);
    // A ramp climbs a full cliff: on or onto one, follow its slope rather than the level rule (not up its side).
    if (rampRun(map, cx, cz) || rampRun(map, ncx, ncz)) return Math.abs(ground(nx, nz) - ground(x, z)) < 0.5;
    return Math.abs(levelAt(map, ncx, ncz) - levelAt(map, cx, cz)) < CLIFF_LEVELS;
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
  const top = (x: number, z: number) => Math.max(ground(x, z), solidTop(x, z));
  return { map, ground, surface, standable, move, wet, top };
}

const islands = new WeakMap<Village, VillageIsland>();
/** The member island's walker, built once per loaded map. */
export function villageIsland(v: Village = village()): VillageIsland {
  let island = islands.get(v);
  if (!island) islands.set(v, island = islandOf(v));
  return island;
}

/** Nearest landmark within `range` of a point (for proximity prompts and discovery). */
export function nearestLandmark(x: number, z: number, range: number, ids?: readonly LandmarkId[], v: Village = village()): Landmark | null {
  let best: Landmark | null = null, distance = range;
  for (const l of landmarks(v)) {
    if (ids && !ids.includes(l.id)) continue;
    const d = Math.hypot(l.x - x, l.z - z);
    if (d < distance) { best = l; distance = d; }
  }
  return best;
}

/**
 * Everything that scales with the island (specs/island-painter.md §7), from the
 * map's land bounds. The shipped 47×39 island gives exactly the numbers these
 * replaced: shadow ±26, clouds 46×38, overview (12, 21, −27), glints to 90,
 * minimap "-26 -22 52 47". Shadows and clouds stay centred on the world origin
 * (the map is), so they reach the land's farthest edge from it.
 */
export function villageScale(v: Village = village()) {
  const { map, bounds: b } = v, deck = wharfDeck(v);
  const reachX = Math.max(-b.minX, b.maxX), reachZ = Math.max(-b.minZ, b.maxZ);
  /** How much bigger than the shipped island, for the overview camera. */
  const k = Math.max(1, b.halfW / 23.5, b.halfD / 19.5);
  const offset: [number, number, number] = [12 * k, 21 * k, -27 * k];
  const further = Math.hypot(12, 21, 27) * (k - 1);
  // The minimap frames the land and the wharf deck with a 2.5 margin.
  const x0 = Math.round(Math.min(b.minX, deck?.x0 ?? Infinity) - 2.5), x1 = Math.round(Math.max(b.maxX, deck?.x1 ?? -Infinity) + 2.5);
  const z0 = Math.round(Math.min(b.minZ, deck?.z0 ?? Infinity) - 2.5), z1 = Math.round(Math.max(b.maxZ, deck?.z1 ?? -Infinity) + 2.5);
  return {
    shadowExtent: Math.max(reachX, reachZ) + 2.5,
    cloudSize: [2 * reachX - 1, 2 * reachZ - 1] as [number, number],
    overview: { focus: [b.cx, 0, b.cz] as [number, number, number], offset, far: 120 + further },
    /** Extra fog distance in the overview, on top of the phase's (+28 near, +15 far). */
    overviewFog: further,
    /** Glints reach this far from the map's centre (the fog). */
    glintRadius: 58 + Math.max(map.width, map.depth) / 2,
    minimap: { x0, x1, z0, z1 },
  };
}
