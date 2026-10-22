/**
 * The world editor's terrain tools (specs/world-editor.md decisions 2, 3 and 10): pure functions over a WorldTerrain,
 * each returning the world rect it changed so the view rewrites only those chunks and the history snapshots only those
 * tiles. The editor (/lab/world) calls them per frame while a button is held.
 *
 * Brush mode (soft round tools, a soft or hard edge):
 * - raise / lower: move the ground up or down, most at the middle;
 * - smooth: pull each sample toward its neighbours' mean;
 * - flatten / level: pull the ground toward a height (flatten: where the stroke began; level: a sampled one), cutting
 *   what is above it, filling what is below, or both;
 * - roughen: add small-scale natural noise; erode: soften edges and pull material downslope (thermal erosion);
 * - paint: set the surface.
 * Cell mode (Minecraft blocks): raise or lower a cell, or an N × N square of them, a whole step at a time, to a level
 * on the step grid, with a slight rounding round its edge so a hill built of cells is not slabs.
 * Pads: a building levels the ground under its footprint. Roads: a path of a set width, painted and graded smooth.
 */
import { LEVEL_STEP, smoothstep, valueNoise } from "../grid";
import { Paint, heightAtSample, sampleX, sampleZ, terrainHeight, type WorldTerrain } from "./terrain";

/** A world rect, units. */
export interface Rect { x0: number; z0: number; x1: number; z1: number }
export const unionRect = (a: Rect | null, b: Rect | null): Rect | null =>
  !a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), z1: Math.max(a.z1, b.z1) };

export type BrushTool = "raise" | "lower" | "smooth" | "flatten" | "level" | "roughen" | "erode" | "paint";

export interface BrushStroke {
  x: number;
  z: number;
  /** Radius, world units. */
  radius: number;
  /** 0..1. */
  strength: number;
  /** A crisp edge (a bank, a quay) rather than the soft falloff. */
  hard?: boolean;
  /** Seconds this application stands for (the frame's time while held). */
  dt: number;
  /** flatten / level: the height pulled to; `mode` cut (only lower), fill (only raise) or both. */
  target?: number;
  mode?: "cut" | "fill" | "both";
  /** paint: the paint id. */
  paint?: number;
  /** roughen: a seed, so each stroke's noise differs. */
  seed?: number;
}

/** How much of the brush reaches a point `r` from its middle (radius R): soft (a smooth bell) or hard (flat to near the rim). */
export function falloff(r: number, R: number, hard = false): number {
  if (r >= R) return 0;
  const u = r / R;
  return hard ? 1 - smoothstep(0.82, 1, u) : (1 - smoothstep(0, 1, u)) ** 1.2;
}

/** Rates at strength 1: raise/lower units a second at the middle; the pull toward a smooth/target height a second. */
export const BRUSH_RATE = { raise: 2.4, smooth: 6, flatten: 8, roughen: 0.5, erode: 4 } as const;

/** Sample index range covering a circle. */
function span(t: WorldTerrain, x: number, z: number, r: number) {
  return {
    i0: Math.max(0, Math.floor((x - r - t.x0) * t.res)), i1: Math.min(t.cols - 1, Math.ceil((x + r - t.x0) * t.res)),
    k0: Math.max(0, Math.floor((z - r - t.z0) * t.res)), k1: Math.min(t.rows - 1, Math.ceil((z + r - t.z0) * t.res)),
  };
}

const rectOf = (t: WorldTerrain, i0: number, i1: number, k0: number, k1: number): Rect => ({ x0: sampleX(t, i0), z0: sampleZ(t, k0), x1: sampleX(t, i1), z1: sampleZ(t, k1) });

/** Apply one frame of a brush. Returns what changed, or null. */
export function applyBrush(t: WorldTerrain, tool: BrushTool, b: BrushStroke): Rect | null {
  const { i0, i1, k0, k1 } = span(t, b.x, b.z, b.radius);
  if (i0 > i1 || k0 > k1) return null;
  const h = t.heights, c = t.cols, s = Math.max(0, Math.min(1, b.strength)), dt = Math.min(b.dt, 0.1);
  const weight = (i: number, k: number) => falloff(Math.hypot(sampleX(t, i) - b.x, sampleZ(t, k) - b.z), b.radius, b.hard);
  let changed = false;
  if (tool === "paint") {
    const id = b.paint ?? Paint.Grass;
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      if (weight(i, k) <= 0.3) continue;
      const p = k * c + i;
      if (t.paint[p] !== id) { t.paint[p] = id; changed = true; }
    }
    if (changed) t.revision++;
    return changed ? rectOf(t, i0, i1, k0, k1) : null;
  }
  // Smooth and erode read a snapshot (one pass a frame, the same whichever way the loop runs).
  const snap = tool === "smooth" || tool === "erode" ? snapshot(t, i0 - 2, i1 + 2, k0 - 2, k1 + 2) : null;
  for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
    const w = weight(i, k);
    if (w <= 0) continue;
    const p = k * c + i, was = h[p];
    if (tool === "raise" || tool === "lower") h[p] += (tool === "raise" ? 1 : -1) * BRUSH_RATE.raise * s * dt * w;
    else if (tool === "smooth") {
      let sum = 0, n = 0;
      for (let dk = -2; dk <= 2; dk++) for (let di = -2; di <= 2; di++) {
        const g = [1, 4, 6, 4, 1][di + 2] * [1, 4, 6, 4, 1][dk + 2];
        sum += snap!.at(i + di, k + dk) * g; n += g;
      }
      h[p] += (sum / n - h[p]) * Math.min(1, BRUSH_RATE.smooth * s * dt * w);
    } else if (tool === "flatten" || tool === "level") {
      const target = b.target ?? h[p], mode = b.mode ?? "both";
      if ((mode === "cut" && h[p] <= target) || (mode === "fill" && h[p] >= target)) continue;
      h[p] += (target - h[p]) * Math.min(1, BRUSH_RATE.flatten * s * dt * w);
    } else if (tool === "roughen") {
      const x = sampleX(t, i), z = sampleZ(t, k), seed = b.seed ?? 1;
      const n = (valueNoise(x / 1.3, z / 1.3, seed) - 0.5) + 0.5 * (valueNoise(x / 0.55, z / 0.55, seed + 7) - 0.5);
      h[p] += n * BRUSH_RATE.roughen * s * dt * w;
    } else if (tool === "erode") {
      // Thermal erosion: what stands steeper than the talus over a neighbour slides down to it; plus a light settle.
      const talus = 0.45 / t.res, here = snap!.at(i, k);
      let out = 0, mean = 0;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const there = snap!.at(i + di, k + dk), d = here - there;
        mean += there / 4;
        if (d > talus) out -= (d - talus) * 0.5;
        else if (-d > talus) out += (-d - talus) * 0.5;
      }
      h[p] += (out * 0.5 + (mean - here) * 0.35) * Math.min(1, BRUSH_RATE.erode * s * dt * w);
    }
    if (h[p] !== was) changed = true;
  }
  if (changed) t.revision++;
  return changed ? rectOf(t, i0, i1, k0, k1) : null;
}

/** A copy of samples [i0..i1] × [k0..k1] (clamped), read by index. */
function snapshot(t: WorldTerrain, i0: number, i1: number, k0: number, k1: number) {
  const a0 = Math.max(0, i0), a1 = Math.min(t.cols - 1, i1), b0 = Math.max(0, k0), b1 = Math.min(t.rows - 1, k1), w = a1 - a0 + 1;
  const data = new Float32Array(w * (b1 - b0 + 1));
  for (let k = b0; k <= b1; k++) data.set(t.heights.subarray(k * t.cols + a0, k * t.cols + a1 + 1), (k - b0) * w);
  return { at: (i: number, k: number) => data[(Math.min(b1, Math.max(b0, k)) - b0) * w + Math.min(a1, Math.max(a0, i)) - a0] };
}

// ── Cell mode ────────────────────────────────────────────────────────

/** The cell (cell indices) a world point is in. */
export const cellAt = (t: WorldTerrain, x: number, z: number): [number, number] => [Math.round(x - t.originX), Math.round(z - t.originZ)];

/** The N × N square of cells round a cell (N odd: centred; even: toward +x/+z), clamped to the map, as cell ranges. */
export function cellSquare(t: WorldTerrain, cx: number, cz: number, n: number): { cx0: number; cx1: number; cz0: number; cz1: number } {
  const lo = Math.floor((n - 1) / 2), hi = n - 1 - lo;
  return { cx0: Math.max(0, cx - lo), cx1: Math.min(t.width - 1, cx + hi), cz0: Math.max(0, cz - lo), cz1: Math.min(t.depth - 1, cz + hi) };
}

/** A cell's height as the samples it covers read it: their mean. */
export function cellHeight(t: WorldTerrain, cx: number, cz: number): number {
  let sum = 0, n = 0;
  for (let k = cz * t.res; k <= (cz + 1) * t.res; k++) for (let i = cx * t.res; i <= (cx + 1) * t.res; i++) { sum += heightAtSample(t, i, k); n++; }
  return sum / n;
}

/** The next level on the step grid above (dir 1) or below (dir −1) a height. */
export function nextLevel(h: number, step: number, dir: 1 | -1): number {
  const q = h / step, near = Math.round(q);
  // A height already on the grid steps a whole step; one between steps goes to the next grid line.
  const on = Math.abs(q - near) < 0.02;
  return (dir > 0 ? (on ? near + 1 : Math.ceil(q)) : (on ? near - 1 : Math.floor(q))) * step;
}

/**
 * The rounded lip of a raised (or dug) square: the ground past its edge eases from `lip` of the step below the level
 * down to the old ground over `reach` units (a sample half a unit out stands about a third of the step up), so a
 * square reads as a rounded mound rather than a slab, and squares at one level side by side merge flat.
 */
export const CELL_EDGE = { reach: 1, lip: 0.35 } as const;

/**
 * Set the N × N square of cells to `level`: raising (dir 1) lifts every sample it covers up to the level (never
 * lowers), digging (dir −1) takes them down to it; just outside, the rounded lip (CELL_EDGE).
 */
export function cellSet(t: WorldTerrain, square: ReturnType<typeof cellSquare>, level: number, dir: 1 | -1, step = LEVEL_STEP): Rect | null {
  const x0 = t.originX + square.cx0 - 0.5, x1 = t.originX + square.cx1 + 0.5, z0 = t.originZ + square.cz0 - 0.5, z1 = t.originZ + square.cz1 + 0.5;
  const reach = CELL_EDGE.reach;
  const i0 = Math.max(0, Math.floor((x0 - reach - t.x0) * t.res)), i1 = Math.min(t.cols - 1, Math.ceil((x1 + reach - t.x0) * t.res));
  const k0 = Math.max(0, Math.floor((z0 - reach - t.z0) * t.res)), k1 = Math.min(t.rows - 1, Math.ceil((z1 + reach - t.z0) * t.res));
  let changed = false;
  for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k), out = Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, z0 - z, z - z1));
    if (out >= reach) continue;
    const drop = out <= 1e-6 ? 0 : step * (CELL_EDGE.lip + (1 - CELL_EDGE.lip) * smoothstep(0, reach, out));
    const target = level - dir * drop, p = k * t.cols + i, was = t.heights[p];
    t.heights[p] = dir > 0 ? Math.max(was, target) : Math.min(was, target);
    if (t.heights[p] !== was) changed = true;
  }
  if (changed) t.revision++;
  return changed ? rectOf(t, i0, i1, k0, k1) : null;
}

// ── Pads ─────────────────────────────────────────────────────────────

/** How far a pad's rim reaches past a footprint, and the ease back to the land beyond it (units): the conversion's. */
export const PAD = { rim: 1, ease: 2.5 } as const;

/**
 * Level the ground under a footprint (half extents hw × hd about (x, z), turned by `yaw`) to `level` (default: the
 * ground at its middle), over the footprint and a rim, easing back to the land. A building placed or moved calls it.
 */
export function padUnder(t: WorldTerrain, x: number, z: number, hw: number, hd: number, yaw = 0, level?: number): Rect | null {
  const target = level ?? terrainHeight(t, x, z), rw = hw + PAD.rim, rd = hd + PAD.rim, far = Math.hypot(rw, rd) + PAD.ease;
  const { i0, i1, k0, k1 } = span(t, x, z, far), c = Math.cos(yaw), s = Math.sin(yaw);
  let changed = false;
  for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
    const dx = sampleX(t, i) - x, dz = sampleZ(t, k) - z, lx = dx * c - dz * s, lz = dx * s + dz * c;
    const out = Math.hypot(Math.max(0, Math.abs(lx) - rw), Math.max(0, Math.abs(lz) - rd)), w = 1 - smoothstep(0, PAD.ease, out);
    if (w <= 0) continue;
    const p = k * t.cols + i, was = t.heights[p];
    t.heights[p] += (target - was) * w;
    if (t.heights[p] !== was) changed = true;
  }
  if (changed) t.revision++;
  return changed ? rectOf(t, i0, i1, k0, k1) : null;
}

// ── Roads ────────────────────────────────────────────────────────────

/** A road: its width, the shoulder over which it eases back into the land, and its steepest grade. */
export const ROAD = { width: 2.4, shoulder: 1.6, maxGrade: 0.18, smooth: 3 } as const;

/**
 * Lay a road along `points` (world x, z): paint `paint` (the path) over its width and grade the ground under it to a
 * smooth profile, the terrain along its middle averaged over ROAD.smooth units each way, no steeper than maxGrade (a
 * gentle ramp on a slope), level across. Its sides ease back into the land over the shoulder. `startY` holds the
 * first point's height (a road carried on from the last segment).
 */
export function layRoad(t: WorldTerrain, points: readonly (readonly [number, number])[], opts: { width?: number; paint?: number; maxGrade?: number; startY?: number } = {}): Rect | null {
  if (points.length < 2) return null;
  const width = opts.width ?? ROAD.width, half = width / 2, maxGrade = opts.maxGrade ?? ROAD.maxGrade, paint = opts.paint ?? Paint.Path;
  // The middle line, sampled every DS.
  const DS = 0.25, line: [number, number][] = [];
  for (let s = 0; s + 1 < points.length; s++) {
    const [ax, az] = points[s], [bx, bz] = points[s + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / DS));
    for (let j = s ? 1 : 0; j <= n; j++) line.push([ax + ((bx - ax) * j) / n, az + ((bz - az) * j) / n]);
  }
  const raw = line.map(([x, z]) => terrainHeight(t, x, z));
  const r = Math.round(ROAD.smooth / DS), prof = raw.map((_, j) => {
    let sum = 0, n = 0;
    for (let q = Math.max(0, j - r); q <= Math.min(raw.length - 1, j + r); q++) { sum += raw[q]; n++; }
    return sum / n;
  });
  if (opts.startY !== undefined) prof[0] = opts.startY;
  // No steeper than maxGrade: forward then backward.
  const most = maxGrade * DS;
  for (let j = 1; j < prof.length; j++) prof[j] = Math.min(prof[j - 1] + most, Math.max(prof[j - 1] - most, prof[j]));
  if (opts.startY === undefined) for (let j = prof.length - 2; j >= 0; j--) prof[j] = Math.min(prof[j + 1] + most, Math.max(prof[j + 1] - most, prof[j]));
  // Every sample near the line: the nearest point of the line, its distance and the profile there.
  let xs0 = Infinity, xs1 = -Infinity, zs0 = Infinity, zs1 = -Infinity;
  for (const [x, z] of line) { xs0 = Math.min(xs0, x); xs1 = Math.max(xs1, x); zs0 = Math.min(zs0, z); zs1 = Math.max(zs1, z); }
  const reach = half + ROAD.shoulder;
  const i0 = Math.max(0, Math.floor((xs0 - reach - t.x0) * t.res)), i1 = Math.min(t.cols - 1, Math.ceil((xs1 + reach - t.x0) * t.res));
  const k0 = Math.max(0, Math.floor((zs0 - reach - t.z0) * t.res)), k1 = Math.min(t.rows - 1, Math.ceil((zs1 + reach - t.z0) * t.res));
  for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k);
    let best = Infinity, y = 0;
    for (let j = 0; j + 1 < line.length; j++) {
      const [ax, az] = line[j], [bx, bz] = line[j + 1], ux = bx - ax, uz = bz - az, l2 = ux * ux + uz * uz || 1;
      const u = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / l2)), d = Math.hypot(x - ax - ux * u, z - az - uz * u);
      if (d < best) { best = d; y = prof[j] + (prof[j + 1] - prof[j]) * u; }
    }
    if (best > reach) continue;
    const p = k * t.cols + i, w = 1 - smoothstep(half, reach, best);
    t.heights[p] += (y - t.heights[p]) * w;
    if (best <= half) t.paint[p] = paint;
  }
  t.revision++;
  return rectOf(t, i0, i1, k0, k1);
}
