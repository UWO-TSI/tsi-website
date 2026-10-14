/**
 * The smooth world's terrain (specs/world-editor.md, row 308): a heightfield and a surface paint map on one grid of
 * samples, RES per world unit, laid over the same cells as the old grid world (cell (0, 0) centred on
 * (originX, originZ), sample (0, 0) on its outer corner). Pure: no React, no three.js. The renderer
 * (components/game/world), the walker (lib/game/defaultIsland.ts), the editor (/lab/world) and the tests all read the
 * ground through the functions here, so what is drawn is what is walked on.
 *
 * THE SURFACE IS THE MESH'S. Every quad of samples is two triangles split along the same diagonal the renderer uses
 * (from its (i, k) corner to its (i + 1, k + 1) corner), and `terrainHeight` interpolates on those triangles, not
 * bilinearly, so a character's feet land exactly on the drawn ground at full detail.
 *
 * The old systems that still think in cells (fishing water, forage and bug nodes, the glide guide, the campfire's
 * sand) read a derived cell map (`cellMapOf`): water where a cell's centre lies under the sea, a level from its
 * height, a surface from its paint. Walking never does: it reads the heights and their slope.
 */
import {
  LEVEL_STEP, MAX_LEVEL, Surface, WATER_DROP, createMap, sdfFromMask, smoothstep, type IslandMap, type ShoreSdf,
} from "../grid";

/** Samples per world unit: a sample every half cell. */
export const RES = 2;
/** The still sea: the water surface the old world drew at level 0 (its sea and rivers), so the wharf, boats and fish line up. */
export const SEA_LEVEL = -WATER_DROP;
/** What the 16-bit heightmap's 0 and 65535 mean, world units: from below the deepest seabed to well above the peak. */
export const HEIGHT_RANGE: readonly [number, number] = [-12, 36];

/** The paint: what covers the ground at a sample. Values are stored in the surface PNG: append only. */
export const Paint = { Grass: 0, Sand: 1, Path: 2, Rock: 3, Stone: 4 } as const;
export type PaintId = (typeof Paint)[keyof typeof Paint];
export const PAINT_NAMES = ["grass", "sand", "path", "rock", "stone"] as const;
/** How each paint previews in the surface PNG (and in the editor's swatches). */
export const PAINT_SWATCH: readonly (readonly [number, number, number])[] = [[143, 161, 108], [226, 203, 147], [186, 150, 100], [140, 133, 119], [176, 172, 166]];

/**
 * How steep ground may be and still be walked up, rise over run (45 degrees). The renderer turns ground to rock from
 * ROCK_SLOPE.from and is all rock by ROCK_SLOPE.to = MAX_CLIMB, so what you cannot climb always reads as rock.
 */
export const MAX_CLIMB = 1;
export const ROCK_SLOPE = { from: 0.6, to: MAX_CLIMB } as const;

export interface WorldTerrain {
  /** Cells along x and z (world units), as the old grid. */
  width: number;
  depth: number;
  /** World x and z of cell (0, 0)'s centre. */
  originX: number;
  originZ: number;
  /** Samples per world unit. */
  res: number;
  /** Samples along x and z: width·res + 1, depth·res + 1. */
  cols: number;
  rows: number;
  /** World x and z of sample (0, 0): the map's outer corner. */
  x0: number;
  z0: number;
  /** Ground height per sample, world units, row after row (z major). */
  heights: Float32Array;
  /** Paint per sample (Paint ids). */
  paint: Uint8Array;
  seaLevel: number;
  /** The heightmap's quantisation range (world units). */
  heightRange: readonly [number, number];
  /** Bumped on every edit, so caches keyed on the terrain know to refresh. */
  revision: number;
}

export function createTerrain(width: number, depth: number, originX: number, originZ: number, opts: { res?: number; seaLevel?: number; heightRange?: readonly [number, number]; fill?: number } = {}): WorldTerrain {
  const res = opts.res ?? RES, cols = width * res + 1, rows = depth * res + 1;
  return {
    width, depth, originX, originZ, res, cols, rows, x0: originX - 0.5, z0: originZ - 0.5,
    heights: new Float32Array(cols * rows).fill(opts.fill ?? 0), paint: new Uint8Array(cols * rows),
    seaLevel: opts.seaLevel ?? SEA_LEVEL, heightRange: opts.heightRange ?? HEIGHT_RANGE, revision: 0,
  };
}

/** World x of sample column i, and z of row k. */
export const sampleX = (t: WorldTerrain, i: number) => t.x0 + i / t.res;
export const sampleZ = (t: WorldTerrain, k: number) => t.z0 + k / t.res;
/** The sample at (i, k), clamped to the grid. */
export function heightAtSample(t: WorldTerrain, i: number, k: number): number {
  const ci = i < 0 ? 0 : i >= t.cols ? t.cols - 1 : i, ck = k < 0 ? 0 : k >= t.rows ? t.rows - 1 : k;
  return t.heights[ck * t.cols + ci];
}

/**
 * THE ground height at a world point: the drawn surface (two triangles a quad, split (i, k)–(i + 1, k + 1)). Off the
 * grid it carries on at the edge's height.
 */
export function terrainHeight(t: WorldTerrain, x: number, z: number): number {
  let u = (x - t.x0) * t.res, v = (z - t.z0) * t.res;
  const maxI = t.cols - 1, maxK = t.rows - 1;
  if (u < 0) u = 0; else if (u > maxI) u = maxI;
  if (v < 0) v = 0; else if (v > maxK) v = maxK;
  let i = Math.floor(u), k = Math.floor(v);
  if (i >= maxI) i = maxI - 1;
  if (k >= maxK) k = maxK - 1;
  const fu = u - i, fv = v - k, h = t.heights, c = t.cols, p = k * c + i;
  const a = h[p], b = h[p + 1], cc = h[p + c], d = h[p + c + 1];
  return fu >= fv ? a + fu * (b - a) + fv * (d - b) : a + fv * (cc - a) + fu * (d - cc);
}

/** The ground's slope at a point, rise per unit along x and z (central differences one sample apart). */
export function terrainGradient(t: WorldTerrain, x: number, z: number): [number, number] {
  const e = 1 / t.res;
  return [(terrainHeight(t, x + e, z) - terrainHeight(t, x - e, z)) / (2 * e), (terrainHeight(t, x, z + e) - terrainHeight(t, x, z - e)) / (2 * e)];
}

/** How steep the ground is at a point: rise over run along its fall line. */
export function terrainSteepness(t: WorldTerrain, x: number, z: number): number {
  const [gx, gz] = terrainGradient(t, x, z);
  return Math.hypot(gx, gz);
}

/** The sample's own slope (the renderer's vertex normals use the same differences). */
export function sampleGradient(t: WorldTerrain, i: number, k: number): [number, number] {
  const e = 2 / t.res;
  return [(heightAtSample(t, i + 1, k) - heightAtSample(t, i - 1, k)) / e, (heightAtSample(t, i, k + 1) - heightAtSample(t, i, k - 1)) / e];
}

/** The paint at a point: the nearest sample's. */
export function paintAt(t: WorldTerrain, x: number, z: number): number {
  const i = Math.round((x - t.x0) * t.res), k = Math.round((z - t.z0) * t.res);
  if (i < 0 || k < 0 || i >= t.cols || k >= t.rows) return Paint.Grass;
  return t.paint[k * t.cols + i];
}

/** How much of `paint` covers a point, 0..1: the four samples around it, bilinearly (what the renderer's splat reads). */
export function paintWeight(t: WorldTerrain, paint: number, x: number, z: number): number {
  const u = Math.min(t.cols - 1, Math.max(0, (x - t.x0) * t.res)), v = Math.min(t.rows - 1, Math.max(0, (z - t.z0) * t.res));
  const i = Math.min(t.cols - 2, Math.floor(u)), k = Math.min(t.rows - 2, Math.floor(v)), fu = u - i, fv = v - k, p = k * t.cols + i, s = t.paint;
  const w = (q: number) => (s[q] === paint ? 1 : 0);
  return (w(p) * (1 - fu) + w(p + 1) * fu) * (1 - fv) + (w(p + t.cols) * (1 - fu) + w(p + t.cols + 1) * fu) * fv;
}

/** Dry land at a point: the ground above the still sea. */
export const isLand = (t: WorldTerrain, x: number, z: number) => terrainHeight(t, x, z) > t.seaLevel;

/** The surface the feet land on (footsteps, the movement's ground kind), in the old grid's Surface vocabulary. */
export function terrainSurface(t: WorldTerrain, x: number, z: number): number {
  if (!isLand(t, x, z)) return Surface.River;
  const p = paintAt(t, x, z);
  return p === Paint.Sand ? Surface.Sand : p === Paint.Path ? Surface.Soil : p === Paint.Stone || p === Paint.Rock ? Surface.Stone : Surface.Grass;
}

/**
 * The old systems' view of the world: one cell per world unit, water where the cell's centre is under the sea (River at
 * level 0, the one sea convention), else a level from the height (`round(h / LEVEL_STEP)`) and a surface from the
 * paint. Rock reads as grass there (the grid has no rock surface: a cell map's stone is a BUILT path with crisp edges).
 */
export function cellMapOf(t: WorldTerrain): IslandMap {
  const map = createMap(t.width, t.depth, t.originX, t.originZ);
  for (let cz = 0; cz < t.depth; cz++) {
    for (let cx = 0; cx < t.width; cx++) {
      const x = t.originX + cx, z = t.originZ + cz, h = terrainHeight(t, x, z), i = cz * t.width + cx;
      if (h <= t.seaLevel) { map.surfaces[i] = Surface.River; map.levels[i] = 0; continue; }
      map.levels[i] = Math.max(0, Math.min(MAX_LEVEL, Math.round(h / LEVEL_STEP)));
      const p = paintAt(t, x, z);
      map.surfaces[i] = p === Paint.Sand ? Surface.Sand : p === Paint.Path ? Surface.Soil : p === Paint.Stone ? Surface.Stone : Surface.Grass;
    }
  }
  return map;
}

/** Samples per cell of the water's shore field (the old grid's SHORE_SDF_SCALE). */
export const SHORE_SCALE = 4;

/**
 * The water's field from the heights (the old `shoreSdf` + `bakeWaterDepth`, read by the water shader through
 * setShoreField): the signed distance from the waterline in units, positive over water, and the seabed's depth under
 * the still surface, the real one, so the water's colour reads the seabed the terrain draws. Near the waterline the
 * distance is the ground's own (its height over its slope), which crosses 0 exactly where the drawn shore is.
 */
export function terrainShoreField(t: WorldTerrain, scale = SHORE_SCALE): ShoreSdf & { depth: Float32Array } {
  const width = t.width * scale, height = t.depth * scale, n = width * height;
  const hs = new Float32Array(n), land = new Uint8Array(n);
  const sx = (i: number) => t.x0 + (i + 0.5) / scale, sz = (j: number) => t.z0 + (j + 0.5) / scale;
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const h = terrainHeight(t, sx(i), sz(j));
    hs[j * width + i] = h;
    if (h > t.seaLevel) land[j * width + i] = 1;
  }
  const sdf = sdfFromMask(land, width, height, scale, { minX: t.x0, minZ: t.z0, sizeX: t.width, sizeZ: t.depth });
  refineShore(t, sdf.data, hs, width, height, scale, t.x0, t.z0);
  const depth = new Float32Array(n);
  for (let k = 0; k < n; k++) depth[k] = sdf.data[k] > 0 ? Math.max(t.seaLevel - hs[k], 1e-4) : 0;
  return { ...sdf, depth };
}

/** Near the waterline, the exact signed distance (height over slope), eased into the transform's further out. */
function refineShore(t: WorldTerrain, data: Float32Array, hs: Float32Array, width: number, height: number, scale: number, ox: number, oz: number) {
  for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
    const k = j * width + i, w = smoothstep(0.5, 1, Math.abs(data[k]));
    if (w >= 1) continue;
    const x = ox + (i + 0.5) / scale, z = oz + (j + 0.5) / scale, g = Math.max(terrainSteepness(t, x, z), 0.05);
    data[k] = ((t.seaLevel - hs[k]) / g) * (1 - w) + data[k] * w;
  }
}

/**
 * Re-bake the shore field inside world rect [x0, x1] × [z0, z1] after an edit (the editor, between strokes): the
 * distance transform over the rect and `margin` units round it, written back inside the rect. Exact for distances
 * under the margin; further out it is the window's estimate, which is all the foam and the colour ever read.
 */
export function refreshShoreField(t: WorldTerrain, f: ShoreSdf & { depth: Float32Array }, x0: number, z0: number, x1: number, z1: number, margin = 12): void {
  const s = f.scale, W = f.width, H = f.height;
  const toI = (x: number) => Math.floor((x - f.minX) * s), toJ = (z: number) => Math.floor((z - f.minZ) * s);
  const a0 = Math.max(0, toI(x0 - margin)), b0 = Math.max(0, toJ(z0 - margin)), a1 = Math.min(W - 1, toI(x1 + margin)), b1 = Math.min(H - 1, toJ(z1 + margin));
  const ww = a1 - a0 + 1, wh = b1 - b0 + 1;
  if (ww <= 0 || wh <= 0) return;
  const hs = new Float32Array(ww * wh), land = new Uint8Array(ww * wh);
  for (let j = 0; j < wh; j++) for (let i = 0; i < ww; i++) {
    const h = terrainHeight(t, f.minX + (a0 + i + 0.5) / s, f.minZ + (b0 + j + 0.5) / s);
    hs[j * ww + i] = h;
    if (h > t.seaLevel) land[j * ww + i] = 1;
  }
  const win = sdfFromMask(land, ww, wh, s, { minX: 0, minZ: 0, sizeX: ww / s, sizeZ: wh / s });
  refineShore(t, win.data, hs, ww, wh, s, f.minX + a0 / s, f.minZ + b0 / s);
  const c0 = Math.max(a0, toI(x0)), d0 = Math.max(b0, toJ(z0)), c1 = Math.min(a1, toI(x1) + 1), d1 = Math.min(b1, toJ(z1) + 1);
  for (let j = d0; j <= d1; j++) for (let i = c0; i <= c1; i++) {
    const k = (j - b0) * ww + (i - a0), d = win.data[k], o = j * W + i;
    f.data[o] = d;
    f.depth[o] = d > 0 ? Math.max(t.seaLevel - hs[k], 1e-4) : 0;
  }
}

/** The seabed's depth under the still surface at a point (0 on land): what the seabed props and the fish stand on. */
export const seabedDepth = (t: WorldTerrain, x: number, z: number) => Math.max(0, t.seaLevel - terrainHeight(t, x, z));
