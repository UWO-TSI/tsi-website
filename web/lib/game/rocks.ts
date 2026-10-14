import {
  type IslandMap, CLIFF_LEVELS, ORTHOGONAL, OVERLAY_SURFACES, Surface, WATER_DROP, cellToWorldX, cellToWorldZ, dropTo, heightField, inBounds,
  isGroundAtWorld, isRamp, levelAt, needsCliff, overlayAt, sampleGroundHeight, surfaceAt, terrainOf,
} from "./grid";
import type { MapObject } from "./villageMap";

/**
 * The island's rock props (specs/v1-drop.md §8c item 4, ref `water-clarity-palette-ref.png`): chunky faceted boulders
 * built in Blender (`art/rocks/build_rocks.py`), matte, one draw per model however many stand. Two ways onto the island:
 *
 * - **Cliff-foot boulders** are a rendering rule, derived from the cliff cells like the cliff pieces themselves: a
 *   share of the wall feet get a boulder tucked against the wall, sunk in the sea at a sea cliff, taller rocks under
 *   taller walls. Nothing is stored; a repainted cliff moves its boulders.
 * - **Accents** (coastal points, beach edges, cliff rims) are a PROPOSAL for David: `rockProposal` picks them, /lab/map
 *   draws them as an overlay he can copy into the map's rock objects. Never written to the map by code.
 */
export const ROCK_MODELS = ["boulder-round", "boulder-tall", "boulder-slab", "boulder-small", "boulder-pillar", "boulder-cluster"] as const;
export type RockModel = (typeof ROCK_MODELS)[number];
export const isRockModel = (m: string | undefined): m is RockModel => !!m && (ROCK_MODELS as readonly string[]).includes(m);
export const rockUrl = (m: RockModel) => `/assets/game/rocks/${m}.glb`;

/** Footprint half extents at the ground (x, z) and the top above it, before scale: printed by the build script. */
export const ROCK_SIZE: Record<RockModel, { half: [number, number]; top: number }> = {
  "boulder-round": { half: [0.51, 0.48], top: 0.66 },
  "boulder-tall": { half: [0.39, 0.38], top: 1.06 },
  "boulder-slab": { half: [0.69, 0.47], top: 0.37 },
  "boulder-small": { half: [0.28, 0.25], top: 0.34 },
  "boulder-pillar": { half: [0.38, 0.37], top: 1.82 },
  "boulder-cluster": { half: [1.01, 0.65], top: 0.79 },
};

export interface RockPlacement { model: RockModel; x: number; z: number; y: number; yaw: number; scale: number; wet: boolean }

/** Hash of a cell and a salt to [0, 1): the same rock on every load and every client. */
function rand(cx: number, cz: number, salt: number): number {
  let h = Math.imul(cx | 0, 0x9e3779b1) ^ Math.imul((cz | 0) + 0x632be5ab, 0x85ebca77) ^ Math.imul(salt + 0x165667b1, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Share of wall feet that get a boulder. */
const FOOT_CHANCE = 0.32;
/** Paths, the plaza and the beach's built edges keep their feet clear. */
const PAVED = new Set<number>([Surface.Stone, Surface.Wood, Surface.Brick, Surface.Soil]);
const pavedAt = (map: IslandMap, x: number, z: number) => OVERLAY_SURFACES.some(o => PAVED.has(o) && overlayAt(map, o, x, z) > 0.2);
/**
 * Walls of two cliffs or more (3 u) take the tall rocks and the clusters; one cliff takes the low single rocks (the
 * clusters are three rocks' triangles, and one-cliff walls are the common ones).
 */
const LOW: readonly RockModel[] = ["boulder-round", "boulder-slab", "boulder-small", "boulder-round", "boulder-slab"];
const HIGH: readonly RockModel[] = ["boulder-tall", "boulder-pillar", "boulder-round", "boulder-cluster", "boulder-tall"];

/** Whether the wall on side `k` of cell (cx, cz) is chosen for a boulder (before the spacing and ground checks). */
function footChosen(map: IslandMap, cx: number, cz: number, k: number): boolean {
  if (!inBounds(map, cx, cz) || !needsCliff(map, cx, cz)) return false;
  const [dx, dz] = ORTHOGONAL[k];
  return dropTo(map, cx, cz, cx + dx, cz + dz) >= CLIFF_LEVELS && rand(cx, cz, k) < FOOT_CHANCE;
}

/**
 * Each map's boulders, kept with its derived terrain: a cell edit (`setCell` forgets the terrain) recomputes them, and
 * the renderer and the water's foam rings share one list.
 */
const BOULDERS = new WeakMap<object, RockPlacement[]>();

/** The boulders at the foot of every cliff wall, as the map's cliff cells imply them. */
export function cliffBoulders(map: IslandMap, field?: Float32Array): RockPlacement[] {
  const key = terrainOf(map), hit = BOULDERS.get(key);
  if (hit) return hit;
  const out = placeBoulders(map, field ?? heightField(map));
  BOULDERS.set(key, out);
  return out;
}

function placeBoulders(map: IslandMap, field: Float32Array): RockPlacement[] {
  const out: RockPlacement[] = [];
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    if (!needsCliff(map, cx, cz)) continue;
    for (let k = 0; k < ORTHOGONAL.length; k++) {
      if (!footChosen(map, cx, cz, k)) continue;
      const [dx, dz] = ORTHOGONAL[k], tx = -dz, tz = dx;
      // One boulder a stretch: not where the neighbour along the same wall took one.
      if (footChosen(map, cx + tx, cz + tz, k)) continue;
      const nx = cx + dx, nz = cz + dz, below = surfaceAt(map, nx, nz);
      if (isRamp(below) || PAVED.has(below)) continue;
      const drop = levelAt(map, cx, cz) - levelAt(map, nx, nz);
      const pick = (drop >= 2 * CLIFF_LEVELS ? HIGH : LOW)[Math.floor(rand(cx, cz, k + 10) * 5)];
      const scale = 0.75 + rand(cx, cz, k + 20) * 0.45;
      // Tucked against the wall: out from it by part of the rock's own depth, anywhere along the cell's edge.
      const outward = 0.5 + ROCK_SIZE[pick].half[1] * scale * (0.35 + 0.3 * rand(cx, cz, k + 30));
      const along = (rand(cx, cz, k + 40) - 0.5) * 0.6;
      const x = cellToWorldX(map, cx) + dx * outward + tx * along, z = cellToWorldZ(map, cz) + dz * outward + tz * along;
      if (pavedAt(map, x, z)) continue;
      const wet = !isGroundAtWorld(map, x, z);
      // In the sea the boulder stands on the bed and shows above the surface; on land it sits on the ground.
      const y = wet ? -WATER_DROP - 0.3 * ROCK_SIZE[pick].top * scale : sampleGroundHeight(map, field, x, z);
      out.push({ model: pick, x, z, y, yaw: rand(cx, cz, k + 50) * Math.PI * 2, scale, wet });
    }
  }
  return out;
}

/** Objects the accents keep clear of, and how far: buildings and the wharf by their size, everything else by a step. */
const CLEAR: Partial<Record<MapObject["kind"], number>> = { landmark: 5, spawn: 3, bridge: 3.5, study: 2.5, fitting: 2.5, missions: 2.5, tree: 1.6, campfire: 3.5 };
const PROPOSAL_SPACING = 2.2;
const PROPOSAL_MAX = 320;

/**
 * Accent rocks for David to review (/lab/map's proposal overlay): rock clusters on coastal points, a stone or two
 * where grass meets the beach, small rocks on cliff rims. On dry land or half in the water at the shore, never on a
 * path, never within a step of an object, a building's or the spawn's clearance, a spot in `avoid` (the beach campfire's
 * ring, which is not a map object until one is placed), or another proposal. Ids are new.
 */
export function rockProposal(v: { map: IslandMap; objects: readonly MapObject[] }, avoid: readonly { x: number; z: number; r: number }[] = []): MapObject[] {
  const { map } = v;
  const water = (cx: number, cz: number) => !inBounds(map, cx, cz) || surfaceAt(map, cx, cz) === Surface.River || levelAt(map, cx, cz) < 0;
  const candidates: { x: number; z: number; model: RockModel; score: number; seed: number }[] = [];
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    if (water(cx, cz)) continue;
    const s = surfaceAt(map, cx, cz), seed = cx * 7919 + cz;
    let near = 0;
    for (let oz = -2; oz <= 2; oz++) for (let ox = -2; ox <= 2; ox++) if (water(cx + ox, cz + oz)) near++;
    const shoreK = ORTHOGONAL.findIndex(([dx, dz]) => water(cx + dx, cz + dz));
    if (shoreK >= 0 && near >= 13 && rand(cx, cz, 101) < 0.55) {
      // A point or a spit: a cluster half in the water off its tip.
      const [dx, dz] = ORTHOGONAL[shoreK];
      candidates.push({ x: cellToWorldX(map, cx) + dx * 0.55, z: cellToWorldZ(map, cz) + dz * 0.55, model: rand(cx, cz, 102) < 0.6 ? "boulder-cluster" : "boulder-round", score: near, seed });
    } else if (shoreK >= 0 && rand(cx, cz, 103) < 0.05) {
      const [dx, dz] = ORTHOGONAL[shoreK];
      candidates.push({ x: cellToWorldX(map, cx) + dx * 0.45, z: cellToWorldZ(map, cz) + dz * 0.45, model: rand(cx, cz, 104) < 0.5 ? "boulder-round" : "boulder-small", score: 4, seed });
    } else if (s === Surface.Grass && ORTHOGONAL.some(([dx, dz]) => surfaceAt(map, cx + dx, cz + dz) === Surface.Sand) && rand(cx, cz, 105) < 0.06) {
      candidates.push({ x: cellToWorldX(map, cx) + (rand(cx, cz, 106) - 0.5) * 0.6, z: cellToWorldZ(map, cz) + (rand(cx, cz, 107) - 0.5) * 0.6, model: "boulder-small", score: 2, seed });
    } else if (needsCliff(map, cx, cz) && rand(cx, cz, 108) < 0.05) {
      candidates.push({ x: cellToWorldX(map, cx) + (rand(cx, cz, 109) - 0.5) * 0.4, z: cellToWorldZ(map, cz) + (rand(cx, cz, 110) - 0.5) * 0.4, model: rand(cx, cz, 111) < 0.5 ? "boulder-slab" : "boulder-small", score: 1, seed });
    }
  }
  // The strongest spots first (points over beach edges over rims), then a fixed shuffle.
  candidates.sort((a, b) => b.score - a.score || rand(a.seed, 0, 112) - rand(b.seed, 0, 112));
  const used = new Set(v.objects.filter(o => o.kind === "rock").map(o => o.id));
  const out: MapObject[] = [];
  let n = 0;
  for (const c of candidates) {
    if (out.length >= PROPOSAL_MAX) break;
    if (pavedAt(map, c.x, c.z)) continue;
    if (v.objects.some(o => Math.hypot(o.x - c.x, o.z - c.z) < (CLEAR[o.kind] ?? (o.kind === "puddle" || o.kind === "bug" ? 0 : 1.25)))) continue;
    if (avoid.some(a => Math.hypot(a.x - c.x, a.z - c.z) < a.r)) continue;
    if (out.some(o => Math.hypot(o.x - c.x, o.z - c.z) < PROPOSAL_SPACING)) continue;
    let id: string;
    do id = `rock-proposed-${++n}`; while (used.has(id));
    const scale = Math.round((0.8 + rand(c.seed, 1, 113) * 0.4) * 100) / 100;
    out.push({ id, kind: "rock", model: c.model, x: Math.round(c.x * 100) / 100, z: Math.round(c.z * 100) / 100, yaw: Math.round(rand(c.seed, 2, 114) * 628) / 100, ...(scale !== 1 ? { scale } : {}) });
  }
  return out;
}
