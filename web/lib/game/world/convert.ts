/**
 * The terrain shaping the world generator shares (lib/game/world/generate.ts): the seabed's shelf, a soft minimum, a
 * contour's signed distance, rock relief on steep land, the steepness limit, the wharf's quay and the building pads.
 * They began as the one-off conversion of the v2 cell world into the smooth heightfield (specs/world-editor.md v0
 * step 2), retired with the cell worlds (row 321; the cell document is in archive/village/).
 *
 * THE WHARF (David, 2026-10-14). Beaches meet the water at sea level and ease in; at the wharf the land stands at the
 * jetty deck's height to the water's edge and drops straight to water deep enough for boats (`wharfQuay`).
 */
import { sampleShore, sdfFromMask, smoothstep, valueNoise, type ShoreSdf } from "../grid";
import { landmarkHalf, turn, type LandmarkId } from "../defaultIsland";
import { TUNING_DEFAULTS } from "../tuning";
import { SHOAL, bedDepth } from "../waterShader";
import { berthWeight } from "../wharf";
import type { World } from "./format";
import { sampleX, sampleZ, type WorldTerrain } from "./terrain";

/** The tuning, world units unless named. */
export const CONVERT = {
  /** The grade (rise over run) of a grass bank meeting the sea. */
  bank: 0.35,
  /** Pads: the rim round a footprint and the ease back to the land. */
  padRim: 1,
  padEase: 2.5,
  /** The steepest any face may be (rise over run). */
  maxGrade: 3,
  /**
   * The wharf's quay (David, 2026-10-14): round the jetty the land stands at the deck's walk height (the pier model's
   * deck top, y 0) right to the water and drops straight to water deep enough for boats. `reach`: the zone's radius
   * round the pier's line (its land end to past the moorings, in the dock's frame), easing out over `ease`.
   */
  quay: { bank: 0, depth: 1.4, run: 0.6, from: 2, to: -5, reach: 5.5, ease: 4 },
  /** Rock relief on steep ground: `rock` units deep, `rockScale` units across. */
  natural: { rock: 0.16, rockScale: 1.6 },
  /**
   * Under the sea (playtest round 1, 2026-10-14): the wide shallows (lib/game/waterShader.ts SHOAL), sand in sight to 4
   * units out; the open sea here has room, so its drop-off runs on through the teal and deep blue to the navy at 16.
   */
  shoal: { ...SHOAL, to: 16 },
} as const;

/**
 * The seabed's depth under the still sea `d` units out from the shore: the open sea's wide shallows (CONVERT.shoal),
 * then the drop to the open sea's floor (4.2, the water's own deepest).
 */
export function shelf(d: number): number {
  return bedDepth(d, TUNING_DEFAULTS.water, 1, CONVERT.shoal);
}

/**
 * A soft minimum of two positive numbers that is exactly 0 when either is 0 (the shore meets the sea level exactly).
 * The higher `power`, the closer to a hard minimum (the softness also lowers a plateau a little where its coast is far).
 */
export const softMin = (a: number, b: number, power = 4) => (a <= 0 || b <= 0 ? Math.min(a, b, 0) : Math.pow(Math.pow(a, -power) + Math.pow(b, -power), -1 / power));

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

/**
 * Rock relief on steep land (the naturalize pass, CONVERT.natural): two octaves of noise, deepest where the ground is
 * steepest, nothing on walkable ground or within reach of the sea (the coast stays where it is).
 */
export function rockRelief(t: WorldTerrain, depth: number = CONVERT.natural.rock, s: number = CONVERT.natural.rockScale): void {
  const h = t.heights, c = t.cols, out = new Float32Array(h.length);
  for (let k = 1; k < t.rows - 1; k++) for (let i = 1; i < c - 1; i++) {
    const p = k * c + i;
    if (h[p] < t.seaLevel + 0.4) continue;
    const gx = (h[p + 1] - h[p - 1]) * t.res / 2, gz = (h[p + c] - h[p - c]) * t.res / 2, w = smoothstep(0.9, 1.8, Math.hypot(gx, gz));
    if (w <= 0) continue;
    const x = sampleX(t, i), z = sampleZ(t, k);
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
export function limitSteepness(t: WorldTerrain, maxGrade = CONVERT.maxGrade, passes = 64): number {
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
