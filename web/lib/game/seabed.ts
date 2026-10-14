/**
 * The seabed under the island's water (v1 water pass, specs/v1-drop.md §8c.1): how far below the still surface it
 * lies at any point. ONE function for the bed mesh (components/game/grid/GridTerrain.tsx) and for the bake the water's
 * colour reads (the water field's depth channel, terrainMaterials.ts setShoreField), so the shallows are always the
 * shade of the sand you can see under them: depth comes from the known seabed, with no depth pass.
 */
import { Surface, coastDistance, overlayAt, sampleShore, shoreSdf, smoothstep, type IslandMap, type ShoreSdf } from "./grid";
import { bedDepth, type WaterParams } from "./waterShader";
import { TUNING_DEFAULTS } from "./tuning";
import { BERTH, berthWeight, type Dock } from "./wharf";

/** How far the bed drops below a grass bank's water at once: the river channel's edge. */
export const BANK_DIP = 0.12;

type BedParams = Pick<WaterParams, "bedDepth" | "bedSlope" | "shelfDepth" | "shelfFrom" | "shelfTo">;

/**
 * World units from the still water's surface down to the bed at world (x, z). The bed under a beach starts AT the
 * waterline and carries the sand's slope on down (a grass bank keeps its 0.12 channel edge). Near the coast the
 * distance is the coast field's own (smooth, so the sand and the bed meet without a step); past a cell the shore
 * field takes over, and past the shallows the drop-off to the open sea (`bedDepth`).
 *
 * On the village (`setShoal`) the open sea shelves out as the wide shallows and the wharf's berth stays deep.
 *
 * Reads the SHIPPED tuning by default, not the live bench value: this is geometry.
 */
export function seabedDip(map: IslandMap, shore: ShoreSdf, x: number, z: number, p: BedParams = TUNING_DEFAULTS.water): number {
  const own = sources.get(map);
  if (own) return own.dip(x, z);
  const far = sampleShore(shore, x, z), k = smoothstep(0.6, 1.2, far);
  return dipAt(map, shore, x, z, k >= 1 ? far : -coastDistance(map, x, z) * (1 - k) + far * k, p);
}

/** The seabed `d` cells out from the coast at (x, z): the profile, a grass bank's dip, the village's shallows and berths. */
function dipAt(map: IslandMap, shore: ShoreSdf, x: number, z: number, d: number, p: BedParams): number {
  const docks = shoals.get(map);
  let bed = bedDepth(d, p, docks ? sampleShore(openField(shore), x, z) : 0);
  // The bank's dip only ever matters where the bed is still shallower than it.
  if (bed < BANK_DIP) bed = Math.max(BANK_DIP * (1 - overlayAt(map, Surface.Sand, x, z)), bed);
  // The berth: at least BERTH.depth inside, easing back to the bed over its edge and in from the waterline (the beach
  // under the jetty still meets the water at 0). An ease, not a max, so the bed has no crease for the bake to round off.
  if (docks) for (const dock of docks) {
    const w = berthWeight(dock, x, z, BERTH_EDGE);
    if (w > 0) bed += (Math.max(bed, BERTH.depth) - bed) * w * smoothstep(0, 1, d);
  }
  return bed;
}

/**
 * The village's sea (David, playtest round 1, 2026-10-14: "make the shallow water bigger area around main island"):
 * its open water shelves out as the wide shallows (lib/game/waterShader.ts SHOAL) where a river keeps its banks, and
 * each wharf's berth (lib/game/wharf.ts BERTH) stays deep for the boats moored there. Set by the village
 * (lib/game/villageMap.ts villageOf) with its wharves; every other island keeps its seabed as it was.
 */
const shoals = new WeakMap<IslandMap, readonly Dock[]>();
export function setShoal(map: IslandMap, docks: readonly Dock[]): void {
  shoals.set(map, docks);
}
/** The berth's edge on the village, cells: softer than the smooth world's quay face (no quay stands over it here). */
export const BERTH_EDGE = 2;
/**
 * Open sea, not a river: a point is open when water at least OPEN_SEA cells from any shore lies within OPEN_LOOK cells
 * of it (a river's middle is about a cell from its banks; a beach's waterline is OPEN_LOOK from water that far out).
 */
const OPEN_LOOK = 4, OPEN_SEA = [2, 3.5] as const;
const opens = new WeakMap<ShoreSdf, ShoreSdf>();
/** How open the water is at each sample of a shore field (0 a river or a pond, 1 the sea), as a field read like it. */
function openField(shore: ShoreSdf): ShoreSdf {
  let f = opens.get(shore);
  if (f) return f;
  const { width: W, height: H, data } = shore, r = Math.round(OPEN_LOOK * shore.scale);
  const along = new Float32Array(W * H), open = new Float32Array(W * H);
  // The farthest from a shore within the square round each sample: the most along x, then the most of that along z.
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let m = -Infinity;
    for (let k = Math.max(0, i - r), e = Math.min(W - 1, i + r); k <= e; k++) if (data[j * W + k] > m) m = data[j * W + k];
    along[j * W + i] = m;
  }
  for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
    let m = -Infinity;
    for (let k = Math.max(0, j - r), e = Math.min(H - 1, j + r); k <= e; k++) if (along[k * W + i] > m) m = along[k * W + i];
    open[j * W + i] = smoothstep(OPEN_SEA[0], OPEN_SEA[1], m);
  }
  opens.set(shore, f = { ...shore, data: open });
  return f;
}

/**
 * The seabed's depth at each sample of the shore field (its centres, its layout): 0 on land, `seabedDip` over water.
 * The water shader reads it bilinearly from the field's second channel.
 */
export function bakeWaterDepth(map: IslandMap, shore: ShoreSdf, p: BedParams = TUNING_DEFAULTS.water): Float32Array {
  const out = new Float32Array(shore.data.length);
  for (let j = 0; j < shore.height; j++) {
    const z = shore.minZ + (j + 0.5) / shore.scale;
    for (let i = 0; i < shore.width; i++) {
      const k = j * shore.width + i, r = shore.data[k];
      if (r <= 0) continue;
      // Past the coast's own reach the dip is the profile of the field's distance alone (no lattice lookups).
      const x = shore.minX + (i + 0.5) / shore.scale;
      out[k] = Math.max(r >= 1.2 ? dipAt(map, shore, x, z, r, p) : seabedDip(map, shore, x, z, p), 1e-4);
    }
  }
  return out;
}

/** The deepest the seabed gets anywhere (the open sea past the drop-off): where the open sea's own floor lies. */
export const deepestSeabed = (p: BedParams = TUNING_DEFAULTS.water) => bedDepth(1e4, p);

const fields = new WeakMap<IslandMap, ShoreSdf>();
/** A map's shore field, made once and shared (the terrain, the water's bake, the seabed's props, the fish). */
export function shoreFieldOf(map: IslandMap): ShoreSdf {
  let f = fields.get(map);
  if (!f) fields.set(map, f = sources.get(map)?.shore() ?? shoreSdf(map));
  return f;
}

/**
 * A world whose seabed is real geometry (the smooth world, lib/game/world/village.ts) says so here for its derived cell
 * map: the seabed's depth at a point and the water's field come from its heights, not from the cells' coast. Every
 * other map has none and keeps the rules above.
 */
export interface WaterSource { dip: (x: number, z: number) => number; shore: () => ShoreSdf }
const sources = new WeakMap<IslandMap, WaterSource>();
export function setWaterSource(map: IslandMap, source: WaterSource): void {
  sources.set(map, source);
  fields.delete(map);
}
