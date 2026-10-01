/**
 * The painter's organic tools and object helpers (specs/island-painter.md §4,
 * §5; natural shapes, specs/terrain-blending.md §5), pure so they are testable
 * and so /lab/map stays a UI.
 *
 * Brush ops read the map as it was when the stroke began (`before`) and change
 * each cell at most once per stroke, so a drag does one step of the operation
 * wherever it passes instead of running away as the brush overlaps itself.
 *
 * ROUND, NOT DIAMONDS. Growing by "take the highest orthogonal neighbour" is a
 * 4-neighbour dilation, and repeating it draws a diamond. The shape ops here
 * threshold a Gaussian blur of the snapshot instead (`blurAt`, sigma one cell),
 * which moves an edge by its curvature: a straight edge a cell per stroke, a
 * convex corner less, a notch more, so repeated strokes round off.
 *
 * The sea is River at level 0 (the one sea convention, lib/game/villageMap.ts):
 * every op that turns land into water writes that, and "water" below means
 * River or legacy Void.
 */
import { CLIFF_LEVELS, DIR_OFFSETS, MAX_LEVEL, Surface, inBounds, isRamp, isWater, smoothstep, squaredDistanceTransform, valueNoise, type IslandMap } from "./grid";
import type { MapObject, ObjectKind } from "./villageMap";

export interface CellSnapshot { levels: Uint8Array; surfaces: Uint8Array }
export const snapshotCells = (map: IslandMap): CellSnapshot => ({ levels: map.levels.slice(), surfaces: map.surfaces.slice() });


/** Height for the shape ops: water is below every level, and off the map is water. */
function heightOf(map: IslandMap, snap: CellSnapshot, x: number, z: number): number {
  if (!inBounds(map, x, z)) return -1;
  const i = z * map.width + x;
  return isWater(snap.surfaces[i]) ? -1 : snap.levels[i];
}
function setWater(map: IslandMap, i: number) { map.surfaces[i] = Surface.River; map.levels[i] = 0; }
/** Land a cell takes from a neighbour: its level, and its surface unless that is a ramp. */
function setLand(map: IslandMap, i: number, level: number, surface: number) {
  map.levels[i] = Math.max(0, Math.min(MAX_LEVEL, level));
  map.surfaces[i] = isRamp(surface) || isWater(surface) ? Surface.Grass : surface;
}

/** Discrete Gaussian, sigma one cell, offsets -3..3 (the 7x7 is its square). */
const GAUSS = [-3, -2, -1, 0, 1, 2, 3].map((d) => Math.exp(-(d * d) / 2));
const GAUSS_SUM = GAUSS.reduce((a, b) => a + b, 0) ** 2;

/** How much of the 7x7 around (x, z), Gaussian-weighted, stands at height `t` or above in the snapshot. */
export function blurAt(map: IslandMap, snap: CellSnapshot, x: number, z: number, t: number): number {
  let sum = 0;
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (heightOf(map, snap, x + dx, z + dz) >= t) sum += GAUSS[dx + 3] * GAUSS[dz + 3];
  return sum / GAUSS_SUM;
}

/** The most common surface among the land neighbours at height `t` or above (ramps count as grass). */
function surfaceNear(map: IslandMap, snap: CellSnapshot, x: number, z: number, t: number): number {
  const count = new Map<number, number>();
  for (const [dx, dz] of DIR_OFFSETS) {
    if (heightOf(map, snap, x + dx, z + dz) < Math.max(0, t)) continue;
    const s = snap.surfaces[(z + dz) * map.width + x + dx], k = isRamp(s) ? Surface.Grass : s;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? Surface.Grass;
}

/**
 * Thresholds on the blur, as shares of the strongest blur in the 3x3 around the
 * cell (so a small islet behaves like a big coast, scaled): grow rises to a
 * height at GROW (a straight edge's next cell has 0.31 of 0.69, so it grows and
 * the one after, at 0.07, does not; a convex corner's diagonal, 0.1, stays
 * water), shrink drops below SHRINK, smooth keeps what has half. TINY is the
 * floor under which a stray cell goes regardless.
 */
const GROW = 0.15, SHRINK = 0.85, TINY = 0.2, DITHER = 0.6;

export type OrganicOp = "smooth" | "grow" | "shrink" | "jitter";

/**
 * One organic step at one cell. `seed` varies the jitter per stroke.
 *
 * - grow: the cell rises to the highest height enough of the blur around it
 *   has: coasts spread into the sea and plateaus widen, round.
 * - shrink: the cell drops while too little of the blur of its own height is
 *   there: coasts and plateaus pull back, round.
 * - smooth: the cell takes the highest height at least half the blur around it
 *   has: notches fill, spikes and stray cells go, straight and 45-degree edges
 *   stay where they are.
 * - jitter: on the coastline, low-frequency noise decides land or water
 *   (level-0 ground only), so a straight painted edge becomes bays and
 *   headlands; each stroke rolls new noise and moves the coast a cell.
 */
export function organicCell(op: OrganicOp, map: IslandMap, before: CellSnapshot, x: number, z: number, seed = 1): void {
  if (!inBounds(map, x, z)) return;
  const i = z * map.width + x, here = heightOf(map, before, x, z);
  if (isRamp(before.surfaces[i])) return;
  const become = (t: number) => {
    if (t === here) return;
    if (t < 0) setWater(map, i);
    else if (here < 0) setLand(map, i, t, surfaceNear(map, before, x, z, t));
    else map.levels[i] = t;
  };
  const blur = (t: number) => blurAt(map, before, x, z, t);
  /** The strongest blur of height `t` in the 3x3 around the cell. */
  const peak = (t: number) => {
    let m = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) m = Math.max(m, blurAt(map, before, x + dx, z + dz, t));
    return m;
  };
  // Dithered per cell and per stroke: a 45-degree edge's next row sits between a straight
  // edge's next row and the one after it, so about half of it moves each stroke and, on
  // average, every edge travels a cell (a fixed threshold leaves octagons).
  const dither = 1 + DITHER * (valueNoise(x, z, seed + 101) - 0.5);
  if (op === "grow") {
    for (let t = MAX_LEVEL; t > here; t--) {
      const b = blur(t);
      if (b > 0 && b >= Math.min(GROW, 0.6 * peak(t)) * dither) return become(t);
    }
    return;
  }
  if (op === "shrink") {
    const drops = (t: number) => { const b = blur(t); return b < TINY || 1 - b >= (1 - Math.min(SHRINK, 0.9 * peak(t))) * dither; };
    if (here < 0 || !drops(here)) return;
    let t = here - 1;
    while (t >= 0 && drops(t)) t--;
    return become(t);
  }
  if (op === "smooth") {
    let t = MAX_LEVEL;
    while (t >= 0 && blur(t) < Math.max(TINY + 0.05, 0.5 * peak(t))) t--;
    // A smoothed level never opens a face taller than the kit draws.
    return become(here >= 0 && t >= 0 && Math.abs(t - here) > CLIFF_LEVELS ? here : t);
  }
  // jitter: only the coastline itself moves, one cell per stroke either way, so a bay never strands a pocket of water.
  const other = DIR_OFFSETS.filter(([dx, dz], d) => d % 2 === 0 && inBounds(map, x + dx, z + dz))
    .map(([dx, dz]) => ({ h: heightOf(map, before, x + dx, z + dz), s: before.surfaces[(z + dz) * map.width + x + dx] }))
    .find(n => (n.h < 0) !== (here < 0));
  if (!other || here > 0) return;
  const land = valueNoise(x / 3.2, z / 3.2, seed) > 0.5;
  if (land === here >= 0) return;
  if (!land) setWater(map, i);
  else if (other.h === 0) setLand(map, i, 0, other.s);
}

/** Cells per level a Slope brush climbs over: a level per 2.5 cells, about 17 degrees, green and walkable. */
export const SLOPE_RUN = 2.5;

/** The brush's cells: within `r + 0.5` of (cx, cz). */
function disc(map: IslandMap, cx: number, cz: number, r: number, fn: (x: number, z: number, d: number) => void) {
  const R = r + 0.5;
  for (let z = Math.floor(cz - R); z <= Math.ceil(cz + R); z++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
    const d = Math.hypot(x - cx, z - cz);
    if (d <= R && inBounds(map, x, z)) fn(x, z, d);
  }
}

/**
 * Soft land or sea under a round brush. The brush adds (or takes) a soft disc
 * to the land the snapshot already has around it, and a cell turns where the
 * sum crosses half: an isolated dab is a round islet, and one near the coast
 * melts into it instead of leaving a stair-stepped seam. Land is new grass at
 * level 0; sea is River at level 0.
 */
export function softDab(map: IslandMap, before: CellSnapshot, cx: number, cz: number, r: number, toLand: boolean, touched: Uint8Array): void {
  const R = r + 0.5;
  disc(map, cx, cz, 1.6 * r + 1, (x, z, d) => {
    const i = z * map.width + x;
    if (touched[i] || isRamp(before.surfaces[i])) return;
    const reach = 1 - smoothstep(0.5 * R, 1.6 * R, d), land = blurAt(map, before, x, z, 0);
    const want = (toLand ? land + reach : land - reach) >= 0.5;
    if (want === (heightOf(map, before, x, z) >= 0)) return;
    touched[i] = 1;
    if (want) setLand(map, i, 0, Surface.Grass);
    else setWater(map, i);
  });
}

/**
 * The Slope brush: the land under the brush rises a level (or sinks, `dir`
 * -1) once per stroke, and the ground around it follows at a level per
 * SLOPE_RUN cells, so a dab is a round hill and a drag a ridge: every step one
 * level (blended, walkable, never a kit cliff). A slope comes back down to
 * sea level at the coast (`waterDist`: squared cell distance to water, from
 * `waterDistance`).
 */
export function slopeDab(map: IslandMap, before: CellSnapshot, cx: number, cz: number, r: number, dir: 1 | -1, touched: Uint8Array, waterDist: Float64Array): void {
  const W = map.width, core: [number, number, number][] = [];
  const cap = (i: number) => Math.floor(Math.sqrt(waterDist[i]) / SLOPE_RUN);
  disc(map, cx, cz, r, (x, z) => {
    const i = z * W + x;
    if (heightOf(map, before, x, z) < 0 || isRamp(before.surfaces[i])) return;
    if (!touched[i]) {
      touched[i] = 1;
      map.levels[i] = Math.max(0, Math.min(MAX_LEVEL, before.levels[i] + dir, dir > 0 ? cap(i) : MAX_LEVEL));
    }
    core.push([x, z, map.levels[i]]);
  });
  const reach = r + 1 + SLOPE_RUN * MAX_LEVEL;
  disc(map, cx, cz, reach, (x, z) => {
    const i = z * W + x;
    if (isWater(map.surfaces[i]) || isRamp(map.surfaces[i])) return;
    let want = map.levels[i];
    for (const [kx, kz, kl] of core) {
      const step = Math.floor(Math.hypot(x - kx, z - kz) / SLOPE_RUN);
      want = dir > 0 ? Math.max(want, Math.min(kl - step, cap(i))) : Math.min(want, kl + step);
    }
    map.levels[i] = want;
  });
}

/** Squared distance from each cell to the nearest water cell (for `slopeDab`), from a snapshot. */
export function waterDistance(map: IslandMap, snap: CellSnapshot): Float64Array {
  return squaredDistanceTransform(map.width, map.depth, (i) => isWater(snap.surfaces[i]));
}

/**
 * The Cliff brush: the land under the brush stands one kit cliff (CLIFF_LEVELS)
 * above `base`, the level where the stroke began (or that far below it,
 * `dir` -1), a flat top with faces the kit draws. Cross it with ramps.
 */
export function cliffDab(map: IslandMap, before: CellSnapshot, cx: number, cz: number, r: number, base: number, dir: 1 | -1): void {
  disc(map, cx, cz, r, (x, z) => {
    const i = z * map.width + x;
    if (heightOf(map, before, x, z) < 0 || isRamp(before.surfaces[i])) return;
    map.levels[i] = dir > 0 ? Math.max(map.levels[i], Math.min(MAX_LEVEL, base + CLIFF_LEVELS)) : Math.min(map.levels[i], Math.max(0, base - CLIFF_LEVELS));
  });
}

/** Cells whose centres fall inside a closed polygon (cell coordinates), even-odd. */
export function cellsInPolygon(poly: readonly (readonly [number, number])[], width: number, depth: number): [number, number][] {
  if (poly.length < 3) return [];
  const xs = poly.map(p => p[0]), zs = poly.map(p => p[1]);
  const out: [number, number][] = [];
  for (let z = Math.max(0, Math.floor(Math.min(...zs))); z <= Math.min(depth - 1, Math.ceil(Math.max(...zs))); z++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(width - 1, Math.ceil(Math.max(...xs))); x++) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i], [xj, zj] = poly[j];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
      }
      if (inside) out.push([x, z]);
    }
  }
  return out;
}

/** The next free id for a kind: `tree-17`. */
export function nextObjectId(kind: ObjectKind, objects: readonly MapObject[]): string {
  const taken = new Set(objects.filter(o => o.kind === kind).map(o => o.id));
  let n = 0;
  while (taken.has(`${kind}-${n}`)) n++;
  return `${kind}-${n}`;
}

/**
 * Snap a placement. Buildings (`half` given) put their front edge and their
 * left edge on cell edges, so the footprint covers whole cells (ACNH grid law:
 * cell centres are integers, edges at n + 0.5). Everything else snaps to
 * `step` (1 = cell centres, 0.5 = half cells).
 */
export function snapPlacement(x: number, z: number, step: number, half?: readonly [number, number]): [number, number] {
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  if (half) return [r(Math.round(x - half[0] - 0.5) + 0.5 + half[0]), r(Math.round(z - half[1] - 0.5) + 0.5 + half[1])];
  return step > 0 ? [r(Math.round(x / step) * step), r(Math.round(z / step) * step)] : [x, z];
}
