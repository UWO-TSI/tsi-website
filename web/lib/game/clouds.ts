/**
 * The cumulus field (sky-ambient rounds 3 and 4, specs/sky-ambient.md §R3, §R4), drawn as lit painted cards
 * (components/game/SkyClouds.tsx). David, round 3: "the clouds still look too 3d model-y and needs remodeld, dont make
 * clouds just spawn and despawn then need to break apard and fade like real clouds ... add more variety of clouds that
 * arent stricly the same shape and size look closer to reference".
 *
 * - **Where:** at most one cloud in each CLOUD_CELL-km square of a layer CLOUD_BASE km up, out to CLOUD_REACH, carried
 *   by the wind (`drift`, km).
 * - **A life:** each square grows a cloud, keeps it a few minutes and lets it go, then grows another (a new shape, size
 *   and spot), all on the world clock, so every client sees the same sky. A cloud's `presence` rises from nothing as it
 *   forms and falls to nothing as it breaks apart (the cards erode it into pieces as it falls: SkyClouds), and the
 *   weather's cover gates it the same soft way, so neither the clock, the weather nor the distance ever pops one.
 * - **What shape:** SHAPES painted cards of five kinds (fair-weather cumulus, broken scraps, flat rolls, towers, wisps;
 *   David's references, 2026-11-05), each built from soft balls and baked once (`bakeCloudAtlas`).
 * - **The sky's bend** (`skyBend`): the curved world drops the sea's far edge below the true horizon, so everything in
 *   the sky is drawn with its elevation lowered (most at the skyline, nothing overhead). The same map for the dome, the
 *   sun, the moon, the stars and the clouds, and it is rigid: it depends on the direction only, never on where the camera
 *   looks, so the sky turns as one piece.
 */

import type { Vec3 } from "./atmosphere";

/** The layer's floor (km above the sea), one cloud's square (km), how far out clouds are kept (km, along the ground). */
export const CLOUD_BASE = 1.5, CLOUD_CELL = 2.1, CLOUD_REACH = 16;
/** At most this many clouds are drawn (the nearest live ones in view); distinct shapes (2 to a row of the atlas). */
export const CLOUD_MAX = 48, SHAPES = 12;
/** The viewer's height (km, atmosphere.ts EYE) and the planet's radius (km): far clouds sink with its curve. */
const EYE_H = 0.2, PLANET_R = 6360;
/**
 * Texels per cloud in the cloud texture: the drawn direction and the distance (km); then the presence (0..1), the shape,
 * the size (km, negative for a mirrored card) and a seed (0..1, plus 1 while it is breaking apart).
 */
export const CLOUD_TEXELS = 2;
/** A square's cycle (s): a cloud lives LIVE of it, forming over FORM of its life, breaking up over the last BREAK. */
const CYCLE = [380, 700] as const, LIVE = 0.82, FORM = 0.22, BREAK = 0.34;
/** The weather's cover lets a cloud in over this much of it (a soft gate, so a change of weather dissolves, never pops). */
const GATE = 0.22;

/** A small integer hash to 0..1 (the layout is the CPU's; the GPU only reads it). */
export function hash3(a: number, b: number, c: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type CloudKind = "cumulus" | "broken" | "flat" | "tower" | "wisp";
/** The atlas's shapes by kind: four cumulus, two of each of the rest. */
export const CLOUD_KINDS: readonly CloudKind[] = ["cumulus", "cumulus", "cumulus", "cumulus", "broken", "broken", "flat", "flat", "tower", "tower", "wisp", "wisp"];
/** Which kinds a fair sky picks (weights per CLOUD_KINDS entry) and which an overcast one does (flat, broken, wisps). */
const FAIR = [1, 1, 1, 1, 0.8, 0.8, 0.6, 0.6, 0.45, 0.45, 0.8, 0.8], GREY = [0.15, 0.15, 0.15, 0.15, 1, 1, 1.6, 1.6, 0, 0, 0.7, 0.7];

/** A square's cloud at world second `t`: its cycle, and its life's presence (0..1) and whether it is breaking up. */
export function cloudLife(i: number, j: number, t: number): { cycle: number; presence: number; breaking: boolean } {
  const period = CYCLE[0] + (CYCLE[1] - CYCLE[0]) * hash3(i, j, 8), at = t / period + hash3(i, j, 9);
  const cycle = Math.floor(at), g = (at - cycle) / LIVE;
  if (g >= 1) return { cycle, presence: 0, breaking: true };
  return { cycle, presence: smooth(0, FORM, g) * (1 - smooth(1 - BREAK, 1, g)), breaking: g > 0.5 };
}

export interface CloudView { x: number; y: number; z: number; cos: number }

/**
 * The live clouds for a weather's cover (0..1), size (km) and grey (0..1) at world second `t`, carried `drift` km by the
 * wind, nearest first, into `out` (CLOUD_TEXELS × 4 floats per cloud, the cloud texture's rows); the number written.
 * With `view` (the camera's forward and the cosine of the widest angle off it that shows) clouds out of view are left
 * out. `dip` is the sky's bend.
 */
export function cloudField(cover: number, size: number, grey: number, t: number, drift: { x: number; y: number }, dip: number, out: Float32Array, view: CloudView | null = null): number {
  const c0x = Math.floor((drift.x - CLOUD_REACH) / CLOUD_CELL), c1x = Math.floor((drift.x + CLOUD_REACH) / CLOUD_CELL);
  const c0z = Math.floor((drift.y - CLOUD_REACH) / CLOUD_CELL), c1z = Math.floor((drift.y + CLOUD_REACH) / CLOUD_CELL);
  // The nearest CLOUD_MAX in view, kept sorted as they are found (no allocation: this runs every frame).
  const max = Math.min(CLOUD_MAX, Math.floor(out.length / (CLOUD_TEXELS * 4)));
  let n = 0;
  for (let i = c0x; i <= c1x; i++) for (let j = c0z; j <= c1z; j++) {
    const life = cloudLife(i, j, t);
    if (life.presence <= 0) continue;
    const c = life.cycle, gate = smooth(0, GATE, cover - hash3(i, j, c * 7 + 1));
    if (gate <= 0) continue;
    const x = (i + 0.15 + 0.7 * hash3(i, j, c * 7 + 2)) * CLOUD_CELL - drift.x, z = (j + 0.15 + 0.7 * hash3(i, j, c * 7 + 3)) * CLOUD_CELL - drift.y;
    const ground = Math.hypot(x, z);
    if (ground > CLOUD_REACH) continue;
    const presence = life.presence * gate * (1 - smooth(CLOUD_REACH * 0.7, CLOUD_REACH, ground));
    if (presence < 0.002) continue;
    // Sizes from small scraps to big banks; a forming cloud swells a little, a dying one spreads as it thins.
    const s = size * (0.5 + 0.95 * hash3(i, j, c * 7 + 4) ** 1.4) * (life.breaking ? 1.14 - 0.14 * presence : 0.86 + 0.14 * presence);
    const y = CLOUD_BASE - EYE_H - (x * x + z * z) / (2 * PLANET_R), d = Math.hypot(x, y, z);
    // Out of view: its centre further off the camera's forward than the view's widest angle plus its own size.
    if (view && (x * view.x + y * view.y + z * view.z) / d < Math.cos(Math.min(Math.PI, Math.acos(view.cos) + (1.9 * s) / d))) continue;
    if (n === max && d >= cand[n - 1].d) continue;
    let k = n < max ? n++ : n - 1;
    while (k > 0 && cand[k - 1].d > d) { const e = cand[k]; cand[k] = cand[k - 1]; cand[k - 1] = e; k--; }
    const e = cand[k];
    e.d = d; e.i = i; e.j = j; e.c = c; e.x = x; e.y = y; e.z = z; e.s = s; e.p = presence; e.out = life.breaking;
  }
  const dir: Vec3 = scratch[0], drawn: Vec3 = scratch[1];
  for (let k = 0; k < n; k++) {
    const { d, i, j, c, x, y, z, s, p, out: breaking } = cand[k], o = k * CLOUD_TEXELS * 4;
    dir[0] = x / d; dir[1] = y / d; dir[2] = z / d;
    skyBend(dir, dip, drawn);
    out[o] = drawn[0]; out[o + 1] = drawn[1]; out[o + 2] = drawn[2]; out[o + 3] = d;
    out[o + 4] = p; out[o + 5] = pickShape(hash3(i, j, c * 7 + 5), grey);
    out[o + 6] = hash3(i, j, c * 7 + 6) > 0.5 ? s : -s; out[o + 7] = hash3(i, j, c * 7 + 7) * 0.999 + (breaking ? 1 : 0);
  }
  return n;
}

/** A shape for a draw `r` (0..1), weighted toward the flat and broken kinds as the sky greys. */
function pickShape(r: number, grey: number): number {
  let sum = 0;
  for (let k = 0; k < SHAPES; k++) sum += FAIR[k] + (GREY[k] - FAIR[k]) * grey;
  let at = r * sum;
  for (let k = 0; k < SHAPES; k++) { at -= FAIR[k] + (GREY[k] - FAIR[k]) * grey; if (at < 0) return k; }
  return SHAPES - 1;
}

const cand = Array.from({ length: CLOUD_MAX }, () => ({ d: 0, i: 0, j: 0, c: 0, x: 0, y: 0, z: 0, s: 0, p: 0, out: false }));
const scratch: [Vec3, Vec3] = [[0, 0, 0], [0, 0, 0]];

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ─── The shapes and their atlas ──────────────────────────────────────────

/** A soft ball of a shape, in units of the cloud's size: x along the card, y up from the flat base, z toward the viewer, r, and a stretch along x. */
export type Ball = [x: number, y: number, z: number, r: number, sx: number];

/**
 * Each shape's balls (card units: x -1.8..1.8, y -0.1..1.1). The kinds after David's references: cumulus with a flat
 * base and bumps crowding the tops of its lobes; broken scraps (a few small clusters and torn puffs, as the sky looking
 * up); flat rolls (a long low bank of small lobes); towers (a column climbing out of a wide foot, the sunset's); wisps
 * (soft streaks drawn out along the card).
 */
export function cloudShape(k: number): Ball[] {
  const r = (i: number, j: number) => hash3(k + 11, i, j), balls: Ball[] = [];
  let seq = 0;
  // A ball with bumps crowding its upper rim and smaller bumps on those (the cauliflower tops); `depth` levels.
  const lobe = (x: number, y: number, z: number, rad: number, bumps: number, sx = 1, depth = 2) => {
    balls.push([x, y, z, rad, sx]);
    if (depth === 0 || rad < 0.03) return;
    const id = seq++;
    for (let m = 0; m < bumps; m++) {
      const a = (r(id, m) - 0.5) * 2.7, br = rad * (depth === 2 ? 0.22 + 0.24 * r(id, m + 9) : 0.34 + 0.2 * r(id, m + 9));
      lobe(x + Math.sin(a) * rad * 0.86 * sx, y + Math.cos(a) * rad * 0.86, z + 0.04, br, depth === 2 ? 2 : 0, 1, depth - 1);
    }
  };
  const kind = CLOUD_KINDS[k];
  if (kind === "cumulus") {
    // Lopsided: one side climbs higher than the other, sometimes a second head.
    const wide = 0.85 + 0.35 * r(0, 0), lean = (r(0, 5) - 0.5) * 0.5, heads = r(0, 6) > 0.55 ? 2 : 1;
    for (let hd = 0; hd < heads; hd++) {
      const hx = heads === 2 ? (hd ? 0.45 : -0.4) * wide : (r(0, 1) - 0.5) * 0.3;
      lobe(hx, 0.05 + 0.12 * r(hd, 2), 0, (0.42 + 0.14 * r(hd, 3)) * (heads === 2 ? 0.85 : 1), 6);
    }
    for (let i = 1; i < 8; i++) {
      const side = i % 2 ? -1 : 1, x = side * wide * (0.3 + 0.24 * Math.ceil(i / 2) + 0.16 * r(i, 1));
      const rad = 0.46 * (1 - 0.32 * Math.abs(x)) * (0.7 + 0.4 * r(i, 2)) * (1 + lean * side);
      lobe(x, rad * (0.15 - 0.45 * r(i, 3)) - 0.06 * Math.abs(x), (r(i, 4) - 0.5) * 0.55, rad, 5);
    }
  } else if (kind === "broken") {
    // Scraps of cumulus, a few to the card, each its own small flat-based heap.
    const parts = 3 + Math.floor(r(0, 0) * 3);
    for (let p = 0; p < parts; p++) {
      const cx = -1.45 + (2.9 * (p + 0.15 + 0.7 * r(p, 1))) / parts, cy = 0.04 + 0.28 * r(p, 2), cr = 0.13 + 0.12 * r(p, 3);
      lobe(cx, cy, 0, cr, 5);
      lobe(cx - cr * (0.7 + 0.5 * r(p, 4)), cy - cr * 0.35, 0.03, cr * 0.65, 4);
      if (r(p, 5) > 0.4) lobe(cx + cr * (0.8 + 0.4 * r(p, 6)), cy - cr * 0.25 + 0.15 * cr * r(p, 7), 0.05, cr * 0.7, 4);
    }
  } else if (kind === "flat") {
    for (let i = 0; i < 11; i++) {
      const x = -1.55 + 3.1 * (i + r(i, 1) * 0.6) / 11, rad = 0.17 + 0.13 * r(i, 2) * (1 - 0.4 * Math.abs(x) / 1.6);
      lobe(x, rad * (0.05 - 0.5 * r(i, 3)) + 0.05, (r(i, 4) - 0.5) * 0.4, rad, 4, 1.25);
    }
  } else if (kind === "tower") {
    const lean = (r(0, 0) - 0.5) * 0.3;
    lobe(0, 0.1, 0, 0.44, 6, 1.2);
    lobe(-0.72, 0.0, -0.1, 0.32, 5);
    lobe(0.78, -0.02, 0.1, 0.3, 5);
    lobe(lean * 0.5 - 0.08, 0.44, 0.05, 0.34, 6);
    lobe(lean + 0.06, 0.7, 0, 0.25, 5);
    lobe(lean * 1.2 + 0.14, 0.9, 0, 0.13, 4);
  } else {
    // Streaks: soft balls stretched along a gentle curve, thinning to the ends.
    const bow = (r(0, 0) - 0.5) * 0.5, tilt = (r(0, 1) - 0.5) * 0.25;
    for (let i = 0; i < 14; i++) {
      const u = i / 13 * 2 - 1, x = u * 1.5, rad = (0.13 + 0.06 * r(i, 2)) * (1 - 0.55 * u * u);
      balls.push([x, 0.32 + bow * (1 - u * u) + tilt * u + (r(i, 3) - 0.5) * 0.08, 0, rad, 2.4]);
    }
  }
  // Loose puffs torn off the outline (not on the wisps: they are all torn).
  if (kind !== "wisp") {
    const core = balls.length;
    for (let m = 0; m < 10; m++) {
      const src = balls[Math.floor(r(20, m) * core)], a = (r(21, m) - 0.5) * 3.2, off = 1.15 + 0.3 * r(23, m);
      balls.push([src[0] + Math.sin(a) * src[3] * off, Math.max(0.03, src[1] + Math.cos(a) * src[3] * off), src[2], Math.max(0.015, src[3] * (0.15 + 0.25 * r(22, m))), 1]);
    }
  }
  return balls;
}

/**
 * The atlas: each shape's card (3.6 sizes across, 1.2 tall), 2 × SHAPES/2 tiles of `w` × `w/2`: the front surface's
 * normal (r, g; from the height blurred over a good share of a lobe, so the light runs over the cloud as one soft mass,
 * not ball by ball), the thickness through it (b, in sizes / 1.6) and the coverage (a: a brushed outline, softer on the
 * wisps). Baked once, so all the detail costs nothing a frame.
 */
export function bakeCloudAtlas(w = 256): Uint8Array {
  const h = w / 2, cols = 2, W = w * cols, out = new Uint8Array(W * h * (SHAPES / cols) * 4), per = w / 3.6, step = 3.6 / w;
  const height = new Float32Array(w * h), light = new Float32Array(w * h), tmp = new Float32Array(w * h), cover = new Float32Array(w * h), thick = new Float32Array(w * h);
  const radius = Math.max(1, Math.round(w / 60));
  for (let k = 0; k < SHAPES; k++) {
    const balls = cloudShape(k), wisp = CLOUD_KINDS[k] === "wisp";
    const noise = (x: number, y: number) => {
      // Three octaves of value noise over the card (smooth, so the edge breaks into lobes, not grain).
      let v = 0, f = 7, amp = 0.6;
      for (let o = 0; o < 3; o++, f *= 2.3, amp *= 0.5) {
        const X = x * f, Y = y * f, xi = Math.floor(X), yi = Math.floor(Y), u = X - xi, t = Y - yi, su = u * u * (3 - 2 * u), st = t * t * (3 - 2 * t);
        const c = (a: number, b: number) => hash3(k * 7 + o, xi + a, yi + b);
        v += amp * ((c(0, 0) * (1 - su) + c(1, 0) * su) * (1 - st) + (c(0, 1) * (1 - su) + c(1, 1) * su) * st);
      }
      return v - 0.5;
    };
    // Each ball over its own box of texels (the outline's distance only matters within REACH of a ball).
    const REACH = 0.16, sd = cover, front = height, back = thick;
    sd.fill(-REACH); front.fill(-1); back.fill(1e9);
    for (const [bx, by, bz, r, sx] of balls) {
      const i0 = Math.max(0, Math.floor(((bx - (r + REACH) * sx) / 1.8 + 1) / 2 * w)), i1 = Math.min(w - 1, Math.ceil(((bx + (r + REACH) * sx) / 1.8 + 1) / 2 * w));
      const j0 = Math.max(0, Math.floor((by - r - REACH + 0.1) / 1.2 * h)), j1 = Math.min(h - 1, Math.ceil((by + r + REACH + 0.1) / 1.2 * h));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const at = j * w + i, dx = ((((i + 0.5) / w) * 2 - 1) * 1.8 - bx) / sx, dy = -0.1 + ((j + 0.5) / h) * 1.2 - by, d2 = dx * dx + dy * dy;
        const v = r - Math.sqrt(d2);
        if (v > sd[at]) sd[at] = v;
        if (v > 0) { const q = Math.sqrt(r * r - d2); if (bz + q > front[at]) front[at] = bz + q; if (bz - q < back[at]) back[at] = bz - q; }
      }
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const at = j * w + i, x = ((i + 0.5) / w * 2 - 1) * 1.8, y = -0.1 + ((j + 0.5) / h) * 1.2;
      // The brushed outline, and the flat base a little ragged too (the wisps' ends torn along their length).
      let d = sd[at] + (wisp ? 0.1 : 0.035) * noise(wisp ? x * 0.5 : x, y);
      // The base flat but gently waved, its corners rounded into the lobes (a smooth minimum, not a ruled line).
      if (!wisp) { const base = y + 0.03 + 0.06 * noise(x * 1.3, 9), kk = 0.05, hh = Math.max(0, Math.min(1, 0.5 + 0.5 * (base - d) / kk)); d = base + (d - base) * hh - kk * hh * (1 - hh); }
      const f = front[at], b = back[at];
      thick[at] = f > b ? f - b : 0;
      height[at] = Math.max(f, 0);
      cover[at] = Math.min(1, Math.max(0, d * per * (wisp ? 0.12 : 1) + (wisp ? 0.2 : 0.5)));
    }
    // The height blurred (three box passes each way, a gaussian about `radius` × 1.7 texels wide) before its normal,
    // with a third of it only lightly blurred: the soft shading between the lobes the references paint.
    light.set(height);
    for (let pass = 0; pass < 6; pass++) {
      const horiz = pass % 2 === 0, src = horiz ? height : tmp, dst = horiz ? tmp : height;
      const lines = horiz ? h : w, len = horiz ? w : h, at = (line: number, q: number) => (horiz ? line * w + q : q * w + line);
      for (let line = 0; line < lines; line++) {
        // A running sum along the line: each texel the mean of those within `radius` (fewer at the ends).
        let sum = 0;
        for (let q = 0; q < Math.min(radius, len); q++) sum += src[at(line, q)];
        for (let q = 0; q < len; q++) {
          if (q + radius < len) sum += src[at(line, q + radius)];
          if (q - radius - 1 >= 0) sum -= src[at(line, q - radius - 1)];
          dst[at(line, q)] = sum / (Math.min(len - 1, q + radius) - Math.max(0, q - radius) + 1);
        }
      }
    }
    for (let at = 0; at < w * h; at++) height[at] = 0.68 * height[at] + 0.32 * light[at];
    const ox = (k % cols) * w, oy = Math.floor(k / cols) * h;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const at = j * w + i, hx = (height[j * w + Math.min(w - 1, i + 1)] - height[j * w + Math.max(0, i - 1)]) / (2 * step);
      const hy = (height[Math.min(h - 1, j + 1) * w + i] - height[Math.max(0, j - 1) * w + i]) / (2 * step);
      // Toward the base the surface turns down into it.
      const y = -0.1 + ((j + 0.5) / h) * 1.2, base = wisp ? 0 : Math.max(0, 1 - y / 0.16);
      let nx = -hx, ny = -hy - 1.6 * base, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const o = ((oy + j) * W + ox + i) * 4;
      out[o] = Math.round((nx * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round(Math.min(1, thick[at] / 1.6) * 255);
      out[o + 3] = Math.round(cover[at] * 255);
    }
  }
  return out;
}

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
