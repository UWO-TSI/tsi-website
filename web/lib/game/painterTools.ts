/**
 * The painter's organic tools and object helpers (specs/island-painter.md §4,
 * §5), pure so they are testable and so /lab/map stays a UI.
 *
 * Brush ops (smooth, grow, shrink, jitter) read the map as it was when the
 * stroke began (`before`) and change each cell at most once per stroke, so a
 * drag does one step of the operation wherever it passes instead of running
 * away as the brush overlaps itself.
 *
 * The sea is River at level 0 (the one sea convention, lib/game/villageMap.ts):
 * every op that turns land into water writes that, and "water" below means
 * River or legacy Void.
 */
import { CLIFF_LEVELS, MAX_LEVEL, Surface, inBounds, isRamp, isRiver, isVoid, type IslandMap } from "./grid";
import { GAUSSIANS, HARMONICS } from "./coast";
import type { MapObject, ObjectKind } from "./villageMap";

export interface CellSnapshot { levels: Uint8Array; surfaces: Uint8Array }
export const snapshotCells = (map: IslandMap): CellSnapshot => ({ levels: map.levels.slice(), surfaces: map.surfaces.slice() });

const water = (s: number) => isRiver(s) || isVoid(s);
const N4: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Height for the morphology ops: water is below every level. */
function heightOf(map: IslandMap, snap: CellSnapshot, x: number, z: number): number {
  const i = z * map.width + x;
  return water(snap.surfaces[i]) ? -1 : snap.levels[i];
}
function setWater(map: IslandMap, i: number) { map.surfaces[i] = Surface.River; map.levels[i] = 0; }
/** Land a cell takes from a neighbour: its level, and its surface unless that is a ramp. */
function setLand(map: IslandMap, i: number, level: number, surface: number) {
  map.levels[i] = Math.max(0, Math.min(MAX_LEVEL, level));
  map.surfaces[i] = isRamp(surface) || water(surface) ? Surface.Grass : surface;
}

export type OrganicOp = "smooth" | "grow" | "shrink" | "jitter";

/**
 * One organic step at one cell. `seed` varies the jitter per stroke.
 *
 * - grow: the cell rises to its highest orthogonal neighbour (coasts spread
 *   into the sea, plateaus widen by a cell).
 * - shrink: the cell drops to its lowest neighbour (coasts retreat, plateaus
 *   narrow).
 * - smooth: majority of the 3×3 decides land or water, and a stray level with
 *   fewer than three matching neighbours joins the level most of them share.
 * - jitter: on the coastline, low-frequency noise decides land or water
 *   (level-0 ground only), so a straight painted edge becomes bays and
 *   headlands; each stroke rolls new noise and moves the coast a cell.
 */
export function organicCell(op: OrganicOp, map: IslandMap, before: CellSnapshot, x: number, z: number, seed = 1): void {
  if (!inBounds(map, x, z)) return;
  const i = z * map.width + x, here = heightOf(map, before, x, z);
  const around = N4.filter(([dx, dz]) => inBounds(map, x + dx, z + dz)).map(([dx, dz]) => ({ h: heightOf(map, before, x + dx, z + dz), s: before.surfaces[(z + dz) * map.width + x + dx] }));
  if (op === "grow" || op === "shrink") {
    const pick = around.reduce((best, n) => (op === "grow" ? n.h > best.h : n.h < best.h) ? n : best, { h: here, s: before.surfaces[i] });
    if (pick.h === here) return;
    if (pick.h < 0) setWater(map, i);
    else if (here < 0) setLand(map, i, pick.h, pick.s);
    else map.levels[i] = pick.h;
    return;
  }
  if (op === "jitter") {
    // Only the coastline itself moves, one cell per stroke either way, so a bay never strands a pocket of water.
    const other = around.find(n => (n.h < 0) !== (here < 0));
    if (!other || here > 0) return;
    const land = valueNoise(x / 3.2, z / 3.2, seed) > 0.5;
    if (land === here >= 0) return;
    if (!land) setWater(map, i);
    else if (other.h === 0) setLand(map, i, 0, other.s);
    return;
  }
  // smooth
  let landCount = 0;
  const levels = new Map<number, number>(), surfaces = new Map<number, number>();
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!inBounds(map, x + dx, z + dz)) continue;
    const h = heightOf(map, before, x + dx, z + dz);
    if (h < 0) continue;
    landCount++;
    if (dx || dz) {
      levels.set(h, (levels.get(h) ?? 0) + 1);
      const s = before.surfaces[(z + dz) * map.width + x + dx];
      surfaces.set(s, (surfaces.get(s) ?? 0) + 1);
    }
  }
  const mode = (m: Map<number, number>) => [...m].sort((a, b) => b[1] - a[1])[0];
  if (landCount >= 5 && here < 0) { const l = mode(levels), s = mode(surfaces); setLand(map, i, l?.[0] ?? 0, s?.[0] ?? Surface.Grass); return; }
  if (landCount < 5 && here >= 0) { setWater(map, i); return; }
  if (here < 0 || isRamp(before.surfaces[i])) return;
  const same = levels.get(here) ?? 0, top = mode(levels);
  if (same < 3 && top && top[1] >= 5 && Math.abs(top[0] - here) <= CLIFF_LEVELS) map.levels[i] = top[0];
}

/** Smooth 2-D value noise in [0, 1], seeded. */
export function valueNoise(x: number, z: number, seed = 1): number {
  const hash = (a: number, b: number) => {
    let h = (a * 374761393 + b * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const x0 = Math.floor(x), z0 = Math.floor(z), tx = x - x0, tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  const a = hash(x0, z0), b = hash(x0 + 1, z0), c = hash(x0, z0 + 1), d = hash(x0 + 1, z0 + 1);
  return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
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

/**
 * A starting coastline: coast.ts's harmonics (the legacy island's organic
 * lobes) with seeded phases and two seeded bays, scaled to `radius` cells,
 * centred on the map. Grass inside, a `beach`-cell sand ring, sea outside, all
 * at level 0. Replaces the terrain; objects are the caller's to keep.
 */
export function generateCoast(map: IslandMap, { seed = 1, radius = Math.min(map.width, map.depth) * 0.36, beach = 2 } = {}): void {
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const phases = HARMONICS.map(() => rnd() * Math.PI * 2);
  const bays = GAUSSIANS.slice(0, 2).map(([, sigma, amp]) => [rnd() * Math.PI * 2, sigma * 1.4, amp] as const);
  const k = radius / 52, cx = (map.width - 1) / 2, cz = (map.depth - 1) / 2;
  for (let z = 0; z < map.depth; z++) for (let x = 0; x < map.width; x++) {
    const a = Math.atan2(z - cz, x - cx), r = Math.hypot(x - cx, z - cz);
    let wobble = 0;
    HARMONICS.forEach(([h, amp], n) => { wobble += amp * Math.sin(h * a + phases[n]); });
    for (const [at, sigma, amp] of bays) { const d = Math.atan2(Math.sin(a - at), Math.cos(a - at)) / sigma; wobble += amp * Math.exp(-d * d); }
    const edge = radius + wobble * k * 1.6, i = z * map.width + x;
    map.levels[i] = 0;
    map.surfaces[i] = r < edge - beach ? Surface.Grass : r < edge ? Surface.Sand : Surface.River;
  }
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
