/**
 * The conversion (specs/world-editor.md v0 step 2): the cell world (`web/data/world-map.json`: levels in 0.75 u steps,
 * every step a wall) into the smooth heightfield, once, so David sculpts from there. Pure; `web/scripts/convert-world.ts`
 * runs it and writes `web/data/world/`. The old file stays.
 *
 * WHAT IT KEEPS. The coast is the old organic coast (the grid's own `shoreSdf`: the painted cells blurred, noised,
 * every cell centre held on its side), so the shore, the rivers, the bays and the islets sit where David drew them.
 * Paths, sand and the plaza's stone come from the grid's organic overlay fields. Objects and annotations are copied
 * unchanged (same cells, same world coordinates); the proposals stay proposals (web/data/proposals).
 *
 * THE HEIGHTS. A level map is a stack of tiers (tier L: the cells at level ≥ L). Each tier's outline is rounded in
 * plan (a narrow Gaussian of its cells, every cell centre held on its own side, so a one-cell trail step survives), and
 * the tier rises 0.75 u across its outline over a width that depends on what the old map drew there:
 * - a ONE-level step (a walkable slope in the old rules) rises over ±W_SLOPE: a natural rolling slope, under 0.4 grade;
 * - a TWO-or-more-level step (an old kit cliff) rises over ±W_CLIFF: a steep rock face (over 2 grade), unwalkable,
 *   read as rock by slope; so the mountain keeps its cliffs and nothing else gains one.
 * The mix follows the boundary (the share of cliff edges near each point), so a cliff tapers into a slope where the
 * old map did. Then the cliff bands are naturalized (CONVERT.natural): their outlines wander, their faces vary in
 * steepness, their tops and feet round over, and steep ground gets rock relief, so a mountain reads as rock and slopes
 * rather than walls.
 *
 * THE COAST. Land falls to the still sea exactly on the organic shoreline at a grade set by what meets the water:
 * a beach (old sand) shelves at G_SAND, a grass bank at G_BANK, a cliff coast (old level ≥ 2 at the water) at G_CLIFF.
 * Under water the seabed shelves gently (`shelf`) and drops to the open sea's floor (the old deepest seabed).
 *
 * PADS. Every building (a landmark with a footprint) stands on ground levelled to its centre over its footprint and a
 * cell round it, easing back to the land over PAD_EASE.
 *
 * THE WHARF (David, 2026-10-14). Beaches meet the water at sea level and ease in; at the wharf the land stands at the
 * jetty deck's height to the water's edge and drops straight to water deep enough for boats (`wharfQuay`).
 *
 * Elevated water (the peak waterfall's channel) has no water in v0 (water is at sea level): its cells become rock at
 * their level; its pond drops to a sea-level pond. Open question in the spec.
 */
import {
  LEVEL_STEP, MAX_LEVEL, Surface, isWater, overlayAt, sampleShore, sdfFromMask, shoreSdf, smoothstep, valueNoise, type IslandMap, type ShoreSdf,
} from "../grid";
import { landmarkHalf, turn, type LandmarkId } from "../defaultIsland";
import { TUNING_DEFAULTS } from "../tuning";
import { SHOAL, bedDepth } from "../waterShader";
import { BERTH, berthWeight } from "../wharf";
import { parseVillage, type VillageDoc } from "../villageMap";
import type { World } from "./format";
import { Paint, createTerrain, sampleX, sampleZ, type WorldTerrain } from "./terrain";

/** The tuning, world units unless named. */
export const CONVERT = {
  /** Plan rounding of each tier's outline (Gaussian sigma, cells) and how far each cell centre is held inside its side. */
  planSigma: 0.75,
  core: 0.12,
  /** Half-width of a one-level slope and of a cliff face. */
  slopeWidth: 1.6,
  cliffWidth: 0.35,
  /** How far along a tier's outline the cliff/slope character blends (sigma, cells). */
  characterSigma: 1.25,
  /** Grades (rise over run) of land meeting the sea: a beach, a grass bank, a cliff coast; blended along the coast (sigma, cells). */
  sand: 0.12,
  bank: 0.35,
  cliff: 2.5,
  coastSigma: 1.5,
  /** Pads: the rim round a footprint and the ease back to the land. */
  padRim: 1,
  padEase: 2.5,
  /** The steepest any face may be (rise over run): where old tiers stack into one tall cliff, it leans back to this. */
  maxGrade: 3,
  /**
   * The wharf's quay (David, 2026-10-14): round the jetty the land stands at the deck's walk height (the pier model's
   * deck top, y 0) right to the water and drops straight to water deep enough for boats. `reach`: the zone's radius
   * round the pier's line (its land end to past the moorings, in the dock's frame), easing out over `ease`.
   */
  quay: { bank: 0, depth: 1.4, run: 0.6, from: 2, to: -5, reach: 5.5, ease: 4 },
  /**
   * The berth (lib/game/wharf.ts BERTH, the dock's frame): the water the jetty's tip, the finger pier, the moored boat
   * and the rowboats need, dug to the quay's depth wherever the old map had land there (a grass ridge stood under two
   * of the rowboats), its edge a quay face `edge` wide.
   */
  berth: BERTH,
  /**
   * The naturalize pass (coordinator, 2026-10-14: the mountain read as long straight flat-topped walls): on the cliff
   * bands only (a one-level slope is left as it is), the outline wanders `wander` units either way along its length
   * (noise `wanderScale` units long), each face's width varies by `vary` either way (some steeper, some gentler, never
   * walkable), a share `shoulder` of every cliff step rounds over three times its width at its top and foot, and steep
   * ground gets rock relief `rock` units deep (`rockScale` units across). Layout and band heights stay.
   */
  natural: { wander: 2.2, wanderScale: 11, vary: 0.55, varyScale: 6, shoulder: 0.4, rock: 0.16, rockScale: 1.6 },
  /**
   * Under the sea (playtest round 1, 2026-10-14): the village's wide shallows (lib/game/waterShader.ts SHOAL), sand in
   * sight to 4 units out; the open sea here has room, so its drop-off runs on through the teal and deep blue to the
   * navy at 16, as the shelf before it did.
   */
  shoal: { ...SHOAL, to: 16 },
} as const;

/**
 * The seabed's depth under the still sea `d` units out from the shore: the open sea's wide shallows (CONVERT.shoal, the
 * village's), then the drop to the open sea's floor (4.2, the water's own deepest).
 */
export function shelf(d: number): number {
  return bedDepth(d, TUNING_DEFAULTS.water, 1, CONVERT.shoal);
}

/**
 * A soft minimum of two positive numbers that is exactly 0 when either is 0 (the shore meets the sea level exactly).
 * The higher `power`, the closer to a hard minimum (the softness also lowers a plateau a little where its coast is far).
 */
export const softMin = (a: number, b: number, power = 4) => (a <= 0 || b <= 0 ? Math.min(a, b, 0) : Math.pow(Math.pow(a, -power) + Math.pow(b, -power), -1 / power));

/** Standard normal CDF (Abramowitz & Stegun 7.1.26). */
function phi(x: number): number {
  const z = Math.abs(x) * Math.SQRT1_2, t = 1 / (1 + 0.3275911 * z);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x < 0 ? 0.5 * (1 - erf) : 0.5 * (1 + erf);
}

/**
 * A per-cell value blurred onto the sample grid: each sample takes the Gaussian (sigma, cells) of the cells round it,
 * each cell counted over its whole width (a box-Gaussian, as the grid's own fields do). Off the map the cells are 0.
 */
export function blurToSamples(vals: Float32Array, W: number, D: number, res: number, sigma: number): Float32Array {
  const cols = W * res + 1, rows = D * res + 1, r = Math.ceil(3 * sigma) + 1;
  // Kernel per sample phase j (sample u = c0 + j / res): weight of cell c0 + o.
  const kern: Float64Array[] = [];
  for (let j = 0; j < res; j++) {
    const k = new Float64Array(2 * r + 1);
    for (let o = -r; o <= r; o++) { const u = j / res - o; k[o + r] = phi(u / sigma) - phi((u - 1) / sigma); }
    kern.push(k);
  }
  const tmp = new Float32Array(D * cols);
  for (let cz = 0; cz < D; cz++) for (let i = 0; i < cols; i++) {
    const c0 = Math.floor(i / res), k = kern[i - c0 * res];
    let s = 0;
    for (let o = -r; o <= r; o++) { const c = c0 + o; if (c >= 0 && c < W) s += k[o + r] * vals[cz * W + c]; }
    tmp[cz * cols + i] = s;
  }
  const out = new Float32Array(rows * cols);
  for (let kk = 0; kk < rows; kk++) {
    const c0 = Math.floor(kk / res), k = kern[kk - c0 * res];
    for (let i = 0; i < cols; i++) {
      let s = 0;
      for (let o = -r; o <= r; o++) { const c = c0 + o; if (c >= 0 && c < D) s += k[o + r] * tmp[c * cols + i]; }
      out[kk * cols + i] = s;
    }
  }
  return out;
}

/** A per-cell value at sample (i, k), eased between cell centres (0 off the map). */
function cellEase(vals: Float32Array, W: number, D: number, res: number, i: number, k: number): number {
  const fx = i / res - 0.5, fz = k / res - 0.5, ax = Math.floor(fx), az = Math.floor(fz);
  const ease = (t: number) => t * t * (3 - 2 * t), tx = ease(fx - ax), tz = ease(fz - az);
  const at = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= W || cz >= D ? 0 : vals[cz * W + cx]);
  return (at(ax, az) * (1 - tx) + at(ax + 1, az) * tx) * (1 - tz) + (at(ax, az + 1) * (1 - tx) + at(ax + 1, az + 1) * tx) * tz;
}

/**
 * A tier's signed distance from its rounded outline at every sample, units, positive inside: the cells blurred
 * (planSigma), each centre held `core` inside its side, the 0.5 contour the outline; a distance transform further out,
 * the field's own value over its slope near it (sub-sample exact).
 */
export function tierDistance(inside: Uint8Array, W: number, D: number, res: number, sigma = CONVERT.planSigma, core = CONVERT.core): Float32Array {
  const cols = W * res + 1, rows = D * res + 1;
  const f = blurToSamples(Float32Array.from(inside), W, D, res, sigma);
  // Hold each cell centre on its side.
  const corr = new Float32Array(W * D);
  for (let cz = 0; cz < D; cz++) for (let cx = 0; cx < W; cx++) {
    const v = centreValue(f, cols, res, cx, cz), c = cz * W + cx;
    corr[c] = inside[c] ? Math.max(0, 0.5 + core - v) : Math.min(0, 0.5 - core - v);
  }
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) f[k * cols + i] += cellEase(corr, W, D, res, i, k);
  return contourDistance(f, cols, rows, res, 0.5);
}

/**
 * The signed distance (units, positive where `f` is above `level`) from a sampled field's `level` contour: a distance
 * transform, and near the contour the field's own value over its slope (sub-sample exact).
 */
export function contourDistance(f: Float32Array, cols: number, rows: number, res: number, level: number): Float32Array {
  const mask = new Uint8Array(cols * rows);
  for (let p = 0; p < mask.length; p++) mask[p] = f[p] >= level ? 1 : 0;
  const sdf = sdfFromMask(mask, cols, rows, res, { minX: 0, minZ: 0, sizeX: cols / res, sizeZ: rows / res });
  const out = new Float32Array(cols * rows);
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const p = k * cols + i, d = -sdf.data[p], w = smoothstep(0.5, 1, Math.abs(d));
    if (w >= 1) { out[p] = d; continue; }
    const gx = (f[k * cols + Math.min(cols - 1, i + 1)] - f[k * cols + Math.max(0, i - 1)]) * res / 2;
    const gz = (f[Math.min(rows - 1, k + 1) * cols + i] - f[Math.max(0, k - 1) * cols + i]) * res / 2;
    out[p] = ((f[p] - level) / Math.max(Math.hypot(gx, gz), 0.05)) * (1 - w) + d * w;
  }
  return out;
}

/** The blurred field at a cell's centre (bilinear between the samples round it). */
function centreValue(f: Float32Array, cols: number, res: number, cx: number, cz: number): number {
  const u = (cx + 0.5) * res, v = (cz + 0.5) * res, i = Math.floor(u), k = Math.floor(v), tu = u - i, tv = v - k;
  const at = (a: number, b: number) => f[b * cols + a];
  return tu === 0 && tv === 0 ? at(i, k) : (at(i, k) * (1 - tu) + at(i + 1, k) * tu) * (1 - tv) + (at(i, k + 1) * (1 - tu) + at(i + 1, k + 1) * tu) * tv;
}

const ORTHO = [[1, 0], [0, 1]] as const;

/** The terrain heights from a cell map (see the header): the tiers, the coast and the seabed. `shore` is the map's organic shore field. */
export function heightsFromCells(map: IslandMap, t: WorldTerrain, levels: Uint8Array, shore = shoreSdf(map)): void {
  const W = map.width, D = map.depth, res = t.res, cols = t.cols, rows = t.rows;
  const land = new Float32Array(cols * rows);
  for (let L = 1; L <= MAX_LEVEL; L++) {
    const inside = new Uint8Array(W * D);
    let any = false;
    for (let c = 0; c < W * D; c++) if (levels[c] >= L) { inside[c] = 1; any = true; }
    if (!any) continue;
    // The tier's character along its outline: the share of its boundary edges near a point that are old kit cliffs.
    const cliffs = new Float32Array(W * D), edges = new Float32Array(W * D);
    for (let cz = 0; cz < D; cz++) for (let cx = 0; cx < W; cx++) for (const [dx, dz] of ORTHO) {
      const nx = cx + dx, nz = cz + dz;
      if (nx >= W || nz >= D) continue;
      const a = cz * W + cx, b = nz * W + nx;
      if (inside[a] === inside[b]) continue;
      const step = Math.abs(levels[a] - levels[b]), cliff = step >= 2 ? 1 : 0;
      edges[a]++; edges[b]++;
      cliffs[a] += cliff; cliffs[b] += cliff;
    }
    const cb = blurToSamples(cliffs, W, D, res, CONVERT.characterSigma), eb = blurToSamples(edges, W, D, res, CONVERT.characterSigma);
    const d = tierDistance(inside, W, D, res), nat = CONVERT.natural;
    for (let p = 0; p < land.length; p++) {
      const share = eb[p] > 1e-3 ? Math.min(1, cb[p] / eb[p]) : 0;
      const w = CONVERT.slopeWidth + (CONVERT.cliffWidth - CONVERT.slopeWidth) * share;
      if (share <= 0) { land[p] += LEVEL_STEP * smoothstep(-1, 1, d[p] / w); continue; }
      // A cliff band, naturalized: its outline wanders, its face's steepness varies, its top and foot round over.
      const x = sampleX(t, p % cols), z = sampleZ(t, Math.floor(p / cols));
      const wander = (valueNoise(x / nat.wanderScale, z / nat.wanderScale, 40 + L) - 0.5) + 0.4 * (valueNoise(x / (nat.wanderScale * 0.33), z / (nat.wanderScale * 0.33), 50 + L) - 0.5);
      const dd = d[p] + share * nat.wander * 2 * wander;
      const ww = w * (1 + share * nat.vary * 2 * (valueNoise(x / nat.varyScale, z / nat.varyScale, 60 + L) - 0.5));
      const face = smoothstep(-1, 1, dd / ww), round = smoothstep(-1, 1, dd / (3 * ww));
      land[p] += LEVEL_STEP * (face + share * nat.shoulder * (round - face));
    }
  }
  // How steeply land meets the sea, per land cell, blurred along the coast over the land cells only.
  const grade = new Float32Array(W * D), isLandCell = new Float32Array(W * D);
  for (let cz = 0; cz < D; cz++) for (let cx = 0; cx < W; cx++) {
    const c = cz * W + cx;
    if (isWater(map.surfaces[c])) continue;
    isLandCell[c] = 1;
    let byWater = false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D || isWater(map.surfaces[nz * W + nx])) byWater = true;
    }
    grade[c] = map.surfaces[c] === Surface.Sand ? CONVERT.sand : byWater && levels[c] >= 2 ? CONVERT.cliff : CONVERT.bank;
  }
  const gNum = blurToSamples(grade, W, D, res, CONVERT.coastSigma), gDen = blurToSamples(isLandCell, W, D, res, CONVERT.coastSigma);
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const p = k * cols + i, x = sampleX(t, i), z = sampleZ(t, k), toShore = -sampleShore(shore, x, z);
    if (toShore <= 0) { t.heights[p] = t.seaLevel - shelf(-toShore); continue; }
    const g = gDen[p] > 1e-3 ? gNum[p] / gDen[p] : CONVERT.bank;
    t.heights[p] = t.seaLevel + softMin(land[p] - t.seaLevel, g * toShore);
  }
}

/**
 * Rock relief on steep land (the naturalize pass, CONVERT.natural): two octaves of noise, deepest where the ground is
 * steepest, nothing on walkable ground or within reach of the sea (the coast stays where it is).
 */
export function rockRelief(t: WorldTerrain, depth: number = CONVERT.natural.rock, scale: number = CONVERT.natural.rockScale): void {
  const h = t.heights, c = t.cols, out = new Float32Array(h.length);
  for (let k = 1; k < t.rows - 1; k++) for (let i = 1; i < c - 1; i++) {
    const p = k * c + i;
    if (h[p] < t.seaLevel + 0.4) continue;
    const gx = (h[p + 1] - h[p - 1]) * t.res / 2, gz = (h[p + c] - h[p - c]) * t.res / 2, w = smoothstep(0.9, 1.8, Math.hypot(gx, gz));
    if (w <= 0) continue;
    const x = sampleX(t, i), z = sampleZ(t, k), s = scale;
    out[p] = w * depth * 2 * ((valueNoise(x / s, z / s, 81) - 0.5) + 0.5 * (valueNoise(x / (s * 0.45), z / (s * 0.45), 82) - 0.5));
  }
  for (let p = 0; p < h.length; p++) h[p] += out[p];
}

/**
 * Lean back any face steeper than `maxGrade` (rise over run between neighbouring samples): both samples move toward
 * each other until it fits, over as many passes as it takes. Where several old tiers met in one place (a level-6
 * plateau straight off the sea) the face would otherwise be a near-vertical wall a few samples tall. Nothing crosses
 * the sea level: land stays land and water stays water, so the coast does not move.
 */
export function limitSteepness(t: WorldTerrain, maxGrade: number = CONVERT.maxGrade, passes = 64): number {
  const m = maxGrade / t.res, h = t.heights, c = t.cols, sea = t.seaLevel, margin = 0.02;
  const wet = new Uint8Array(h.length);
  for (let p = 0; p < h.length; p++) wet[p] = h[p] <= sea ? 1 : 0;
  const clampSide = (p: number, v: number) => (wet[p] ? Math.min(v, sea - margin) : Math.max(v, sea + margin));
  let moved = 0;
  for (let pass = 0; pass < passes; pass++) {
    let changed = 0;
    for (let k = 0; k < t.rows; k++) for (let i = 0; i < c; i++) {
      const p = k * c + i;
      for (const q of [i + 1 < c ? p + 1 : -1, k + 1 < t.rows ? p + c : -1]) {
        if (q < 0) continue;
        const d = h[q] - h[p], over = Math.abs(d) - m;
        if (over <= 1e-4) continue;
        const shift = (over / 2) * Math.sign(d);
        const np = h[p] + shift, nq = h[q] - shift;
        h[p] = wet[p] && np > sea - margin ? Math.min(np, Math.max(h[p], sea - margin)) : clampSide(p, np);
        h[q] = wet[q] && nq > sea - margin ? Math.min(nq, Math.max(h[q], sea - margin)) : clampSide(q, nq);
        changed++;
      }
    }
    moved += changed;
    if (!changed) break;
  }
  return moved;
}

/**
 * The wharf's quay (David, 2026-10-14; CONVERT.quay): within the zone round each wharf the land is raised to the
 * jetty deck's height up to the shoreline, and the water drops within `run` of it to `depth`, so the pier stands over
 * deep water and the boats moor alongside a bank, not over a beach. Every other coast keeps its own profile. `shore`
 * is the map's organic shore field (positive over water, units).
 */
export function wharfQuay(t: WorldTerrain, objects: World["objects"], shore: ShoreSdf): number {
  const q = CONVERT.quay;
  let n = 0;
  for (const o of objects) {
    if (o.kind !== "landmark" || o.id !== "wharf") continue;
    n++;
    const yaw = o.yaw ?? 0, [ax, az] = turn(0, q.from, yaw), [bx, bz] = turn(0, q.to, yaw);
    const a = [o.x + ax, o.z + az], b = [o.x + bx, o.z + bz], far = q.reach + q.ease;
    const i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - far - t.x0) * t.res)), i1 = Math.min(t.cols - 1, Math.ceil((Math.max(a[0], b[0]) + far - t.x0) * t.res));
    const k0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - far - t.z0) * t.res)), k1 = Math.min(t.rows - 1, Math.ceil((Math.max(a[1], b[1]) + far - t.z0) * t.res));
    const ux = b[0] - a[0], uz = b[1] - a[1], len2 = ux * ux + uz * uz;
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const x = sampleX(t, i), z = sampleZ(t, k), s = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / len2));
      const w = 1 - smoothstep(q.reach, far, Math.hypot(x - a[0] - ux * s, z - a[1] - uz * s));
      if (w <= 0) continue;
      const p = k * t.cols + i, out = sampleShore(shore, x, z);
      const target = out <= 0 ? Math.max(t.heights[p], q.bank) : Math.min(t.heights[p], t.seaLevel - q.depth * smoothstep(0, q.run, out));
      t.heights[p] += (target - t.heights[p]) * w;
      // The berth: deep water wherever the boats and the finger pier stand.
      const bw = berthWeight(o, x, z);
      if (bw > 0) t.heights[p] += (Math.min(t.heights[p], t.seaLevel - q.depth) - t.heights[p]) * bw;
    }
  }
  return n;
}

export { berthWeight };

/** Level the ground under every building: its footprint and a rim, at its centre's height, easing back over padEase. */
export function padBuildings(t: WorldTerrain, objects: World["objects"]): number {
  let n = 0;
  for (const o of objects) {
    if (o.kind !== "landmark") continue;
    const half = landmarkHalf(o.id as LandmarkId, o.yaw ?? 0, o.scale ?? 1);
    if (!half) continue;
    n++;
    const hx = half[0] + CONVERT.padRim, hz = half[1] + CONVERT.padRim, ease = CONVERT.padEase;
    const ci = Math.round((o.x - t.x0) * t.res), ck = Math.round((o.z - t.z0) * t.res), target = t.heights[ck * t.cols + ci];
    const i0 = Math.max(0, Math.floor((o.x - hx - ease - t.x0) * t.res)), i1 = Math.min(t.cols - 1, Math.ceil((o.x + hx + ease - t.x0) * t.res));
    const k0 = Math.max(0, Math.floor((o.z - hz - ease - t.z0) * t.res)), k1 = Math.min(t.rows - 1, Math.ceil((o.z + hz + ease - t.z0) * t.res));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const dx = Math.max(0, Math.abs(sampleX(t, i) - o.x) - hx), dz = Math.max(0, Math.abs(sampleZ(t, k) - o.z) - hz);
      const w = 1 - smoothstep(0, ease, Math.hypot(dx, dz)), p = k * t.cols + i;
      t.heights[p] += (target - t.heights[p]) * w;
    }
  }
  return n;
}

export interface ConvertReport {
  /** Cells of elevated water turned to rock (the waterfall's channel) and dropped to a sea-level pond. */
  driedWater: number;
  pondCells: number;
  pads: number;
  /** Wharves given a quay. */
  quays: number;
  objects: number;
  annotations: number;
}

/** The whole conversion: a cell document in, a smooth world out (heights not yet quantised; the writer does that). */
export function convertCells(doc: VillageDoc, opts: { res?: number } = {}): { world: World; report: ConvertReport } {
  const { map, objects, annotations } = parseVillage(doc);
  const W = map.width, D = map.depth;
  // Elevated water (water is at sea level in v0): a pond (a body at level 1 with no lower water in it) drops to the sea's
  // level; the fall's channel above it becomes rock at its level.
  const levels = map.levels.slice(), rock = new Uint8Array(W * D);
  let driedWater = 0, pondCells = 0;
  for (let c = 0; c < W * D; c++) {
    if (!isWater(map.surfaces[c]) || map.levels[c] === 0) continue;
    if (map.levels[c] === 1) { map.levels[c] = 0; levels[c] = 0; pondCells++; continue; }
    map.surfaces[c] = Surface.Grass; rock[c] = 1; driedWater++;
  }
  for (let c = 0; c < W * D; c++) if (isWater(map.surfaces[c])) levels[c] = 0;
  const t = createTerrain(W, D, map.originX, map.originZ, { res: opts.res ?? 2 });
  if (t.res % 2) throw new Error("the conversion needs an even resolution (cell centres on samples)");
  const shore = shoreSdf(map);
  heightsFromCells(map, t, levels, shore);
  rockRelief(t);
  const quays = wharfQuay(t, objects, shore);
  const pads = padBuildings(t, objects);
  limitSteepness(t);
  // Paint: the grid's organic overlays (built stone, worn paths, the beach), sand under the water, rock where water dried.
  for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
    const p = k * t.cols + i, x = sampleX(t, i), z = sampleZ(t, k);
    const cx = Math.min(W - 1, Math.max(0, Math.round(x - map.originX))), cz = Math.min(D - 1, Math.max(0, Math.round(z - map.originZ)));
    t.paint[p] = t.heights[p] <= t.seaLevel ? Paint.Sand
      : rock[cz * W + cx] ? Paint.Rock
      : overlayAt(map, Surface.Stone, x, z) > 0.5 ? Paint.Stone
      : overlayAt(map, Surface.Soil, x, z) > 0.5 ? Paint.Path
      : overlayAt(map, Surface.Sand, x, z) > 0.5 ? Paint.Sand
      : Paint.Grass;
  }
  return {
    world: { terrain: t, objects, annotations, source: "converted from web/data/world-map.json (scripts/convert-world.ts)" },
    report: { driedWater, pondCells, pads, quays, objects: objects.length, annotations: annotations.length },
  };
}
