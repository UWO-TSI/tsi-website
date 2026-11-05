/**
 * The cumulus field (sky-ambient round 3, specs/sky-ambient.md §R3). David, round 2: "clouds model look horrible, i
 * wanna know whats the best way for good looking clouds without sacrificing too much performance". One layout feeds
 * every way of drawing them (the painted sky, the models, the lit sprites), so the three can be compared on the same
 * sky and the pick keeps it.
 *
 * - **Where:** at most one cloud in each CLOUD_CELL-km square of a layer CLOUD_BASE km up, out to CLOUD_REACH, carried
 *   by the wind (`drift`, km). The weather's cover sets how many: a cloud grows in as the cover passes its own share and
 *   shrinks away as it falls, so a change of weather never pops one.
 * - **What shape:** SHAPES cumulus, each a cluster of LOBES balls sitting on a flat base (a tall middle, smaller lobes
 *   falling away to the ends), turned and sized per cloud.
 * - **The sky's bend** (`skyBend`): the curved world drops the sea's far edge below the true horizon, so everything in
 *   the sky is drawn with its elevation lowered (most at the skyline, nothing overhead). The same map for the dome, the
 *   sun, the moon, the stars and the clouds, and it is rigid: it depends on the direction only, never on where the camera
 *   looks, so the sky turns as one piece.
 */

import type { Vec3 } from "./atmosphere";

/** The layer's floor (km above the sea), one cloud's square (km), how far out clouds are kept (km, along the ground). */
export const CLOUD_BASE = 1.5, CLOUD_CELL = 2.6, CLOUD_REACH = 18;
/** At most this many clouds are drawn (the nearest in view); lobes per cloud; distinct shapes. */
export const CLOUD_MAX = 40, LOBES = 7, SHAPES = 8;
/** The viewer's height (km, atmosphere.ts EYE) and the planet's radius (km): far clouds sink with its curve. */
const EYE_H = 0.2, PLANET_R = 6360;
/** Texels per cloud in the cloud texture: LOBES lobes, the centre, the drawn direction, the look. */
export const CLOUD_TEXELS = LOBES + 3;

/** A small integer hash to 0..1 (the layout is the CPU's; the GPU only reads it). */
export function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The shapes, in units of the cloud's size: [x, y, z, r] per lobe, x along the cloud, y up from its flat base, z across.
 * Lobe 0 is the tall middle; the rest alternate sides, smaller and lower the further out they sit, one crowning the top.
 */
export const CLOUD_SHAPES: readonly (readonly [number, number, number, number])[][] = Array.from({ length: SHAPES }, (_, k) => {
  const r = (i: number, j: number) => hash3(k + 11, i, j);
  const lobes: [number, number, number, number][] = [[0, 0.16, 0, 0.6]];
  for (let i = 1; i < LOBES - 1; i++) {
    const side = i % 2 ? -1 : 1, x = side * (0.3 + 0.24 * Math.ceil(i / 2) + 0.18 * r(i, 1));
    const rad = 0.6 * (1 - 0.32 * Math.abs(x)) * (0.78 + 0.3 * r(i, 2));
    lobes.push([x, rad * (0.05 + 0.4 * r(i, 3)), (r(i, 4) - 0.5) * 0.55, rad]);
  }
  lobes.push([(r(9, 1) - 0.5) * 0.5, 0.52 + 0.12 * r(9, 2), (r(9, 3) - 0.5) * 0.2, 0.36 + 0.08 * r(9, 4)]);
  return lobes;
});

export interface CloudView { x: number; y: number; z: number; cos: number }

/**
 * The clouds for a weather's cover (0..1) and size (km), carried `drift` km by the wind, nearest first, into `out`
 * (CLOUD_TEXELS × 4 floats per cloud, the cloud texture's rows); the number written. With `view` (the camera's forward
 * and the cosine of the widest angle off it that shows) clouds out of view are left out. `dip` is the sky's bend.
 */
export function cloudField(cover: number, size: number, drift: { x: number; y: number }, dip: number, out: Float32Array, view: CloudView | null = null): number {
  const c0x = Math.floor((drift.x - CLOUD_REACH) / CLOUD_CELL), c1x = Math.floor((drift.x + CLOUD_REACH) / CLOUD_CELL);
  const c0z = Math.floor((drift.y - CLOUD_REACH) / CLOUD_CELL), c1z = Math.floor((drift.y + CLOUD_REACH) / CLOUD_CELL);
  // The nearest CLOUD_MAX in view, kept sorted as they are found (no allocation: this runs every frame).
  const max = Math.min(CLOUD_MAX, Math.floor(out.length / (CLOUD_TEXELS * 4)));
  let n = 0;
  for (let i = c0x; i <= c1x; i++) for (let j = c0z; j <= c1z; j++) {
    const born = hash3(i, j, 1);
    if (cover <= born) continue;
    const x = (i + 0.2 + 0.6 * hash3(i, j, 2)) * CLOUD_CELL - drift.x, z = (j + 0.2 + 0.6 * hash3(i, j, 3)) * CLOUD_CELL - drift.y;
    const ground = Math.hypot(x, z);
    if (ground > CLOUD_REACH) continue;
    const fade = Math.min(1, (cover - born) / 0.08) * (1 - smooth(CLOUD_REACH * 0.7, CLOUD_REACH, ground));
    const s = size * (0.65 + 0.55 * hash3(i, j, 4)) * fade, y = CLOUD_BASE - EYE_H - (x * x + z * z) / (2 * PLANET_R);
    const d = Math.hypot(x, y, z);
    // Out of view: its centre further off the camera's forward than the view's widest angle plus its own size.
    if (view && (x * view.x + y * view.y + z * view.z) / d < Math.cos(Math.min(Math.PI, Math.acos(view.cos) + (1.6 * s) / d))) continue;
    if (n === max && d >= cand[n - 1].d) continue;
    let k = n < max ? n++ : n - 1;
    while (k > 0 && cand[k - 1].d > d) { const c = cand[k]; cand[k] = cand[k - 1]; cand[k - 1] = c; k--; }
    const c = cand[k];
    c.d = d; c.i = i; c.j = j; c.x = x; c.y = y; c.z = z; c.s = s; c.fade = fade;
  }
  const dir: Vec3 = scratch[0], drawn: Vec3 = scratch[1];
  for (let k = 0; k < n; k++) {
    const { d, i, j, x, y, z, s, fade } = cand[k], o = k * CLOUD_TEXELS * 4;
    dir[0] = x / d; dir[1] = y / d; dir[2] = z / d;
    skyBend(dir, dip, drawn);
    const shape = Math.floor(hash3(i, j, 5) * SHAPES), yaw = hash3(i, j, 6) * Math.PI * 2, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const lobes = CLOUD_SHAPES[shape];
    for (let l = 0; l < LOBES; l++) {
      const [lx, ly, lz, lr] = lobes[l], p = o + l * 4;
      out[p] = (lx * cy - lz * sy) * s; out[p + 1] = ly * s; out[p + 2] = (lx * sy + lz * cy) * s; out[p + 3] = lr * s;
    }
    const p = o + LOBES * 4;
    out[p] = x; out[p + 1] = y; out[p + 2] = z; out[p + 3] = s;
    out[p + 4] = drawn[0]; out[p + 5] = drawn[1]; out[p + 6] = drawn[2]; out[p + 7] = d;
    out[p + 8] = fade; out[p + 9] = shape; out[p + 10] = yaw > Math.PI ? 1 : 0; out[p + 11] = hash3(i, j, 7);
  }
  return n;
}

const cand = Array.from({ length: CLOUD_MAX }, () => ({ d: 0, i: 0, j: 0, x: 0, y: 0, z: 0, s: 0, fade: 0 }));
const scratch: [Vec3, Vec3] = [[0, 0, 0], [0, 0, 0]];

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ─── The sky's bend ──────────────────────────────────────────────────────

/** Elevation (radians) as drawn: lowered by `dip` at the skyline, by less the higher it is, not at all overhead. */
export function bendElevation(e: number, dip: number): number {
  const k = 1 - e / (Math.PI / 2);
  return e >= 0 ? e - dip * k * k : e * (1 + (2 * dip) / (Math.PI / 2)) - dip;
}

/** A sky direction as drawn (unit), into `out`. */
export function skyBend(d: Vec3, dip: number, out: Vec3): Vec3 {
  const e = Math.asin(Math.max(-1, Math.min(1, d[1]))), h = Math.hypot(d[0], d[2]), b = bendElevation(e, dip);
  const c = Math.cos(b) / (h || 1);
  out[0] = h ? d[0] * c : 0; out[1] = Math.sin(b); out[2] = h ? d[2] * c : 0;
  return out;
}

/** The same map for the shaders: `skyBend(dir)` with the dip in `uDip`. */
export const SKY_BEND_GLSL = /* glsl */ `
uniform float uDip;
vec3 skyBend(vec3 d) {
  float e = asin(clamp(d.y, -1.0, 1.0)), k = 1.0 - e / 1.5707963, h = length(d.xz);
  float b = e >= 0.0 ? e - uDip * k * k : e * (1.0 + 2.0 * uDip / 1.5707963) - uDip;
  return h > 1e-6 ? vec3(d.xz / h * cos(b), sin(b)).xzy : vec3(0.0, sign(d.y), 0.0);
}
`;
