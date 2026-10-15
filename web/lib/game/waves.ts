/**
 * The sea's waves (David, 2026-10-14: "make more water waves in the game, use make the simulate natural waves and have
 * the boat rock based on water waves"): a sum of directional Gerstner waves, a long swell and up to three shorter wind
 * waves, ONE function on the GPU (WATER_WAVES, printed from the constants below) and on the CPU (`waterWaves`, a line
 * for line mirror), driven by the world clock, so every client draws the same sea and floats its boats on it.
 *
 * ── GERSTNER ────────────────────────────────────────────────────────────
 * Each train moves the surface point at rest position p round a circle-ish orbit: up `a·sin θ` and along its heading
 * `q·a·cos θ`, θ = k·(d·p) − ω·t. The along part bunches the points under the crests and spreads them in the troughs,
 * which is the natural crest sharpening (q = 1 is the trochoid of a real deep-water wave; the wind waves take more, a
 * style call, `waveSteepness`). The trains keep Σ q·k·a under 1, so the surface never loops.
 *
 * ── DEPTH (the real seabed) ─────────────────────────────────────────────
 * A wave feels the bottom: each train fades out over its own depth (`shoal`, the longer the deeper), read from the
 * water field's depth channel, the same seabed the bed mesh is built on. It also slows: in shallow water it lags the
 * deep sea's phase by up to `waveShoalLag` seconds, so its crests bunch up, turn toward the beach and arrive late. A
 * lag, not a slower clock: a speed that varied by place would wind the phase up without bound as the day runs on.
 *
 * ── CALM ────────────────────────────────────────────────────────────────
 * The field's calm (lib/game/seabed.ts bakeWaveCalm): 1 on the open sea, a quarter in a river or a pond, and the
 * wharf's berth calmed, so the moored boats rock gently and the river stays a river.
 *
 * ── MESH ────────────────────────────────────────────────────────────────
 * A vertex can only show a wave a few vertices long: `spacing` (the mesh's own vertex spacing there, the open sea's
 * graded rings; 0 is the island's cell mesh) fades each train out of the displacement before it would alias. The
 * water's fragment shader evaluates the same sum per pixel for its normal (its `spacing` the pixel's footprint), so a
 * wave too short for the mesh still shows in the light.
 */
import type { WaterParams } from "./waterShader";

/** The most trains the shader has room for; Lite draws the first WAVE_LITE (the swell and the main wind wave). */
export const WAVE_MAX = 4;
export const WAVE_LITE = 2;

export type WaveParams = Pick<WaterParams, "waveHeight" | "waveScale" | "waveSpeed" | "swellHeight" | "swellLength" | "swellSpeed" | "waveSteepness" | "waveShoalLag">;

/**
 * The trains, in order of what a lighter tier keeps. `dir` its heading (normalised below), `length` and `amp` shares of
 * its group's wavelength and height (the swell's: swellLength / swellHeight; the wind's: waveScale / waveHeight),
 * `shoal` the depth (world units) over which the bed calms it. The wind waves keep a near-constant steepness (k·a),
 * as a wind sea does, and sit either side of the wind (19°): 57° and −16°. The swell rolls in from its own quarter.
 */
export const TRAINS = [
  { swell: true, dir: [0.8, -0.6], length: 1, amp: 1, shoal: 2.0 },
  { swell: false, dir: [1, 0.35], length: 1, amp: 1, shoal: 1.1 },
  { swell: false, dir: [0.55, 0.84], length: 0.62, amp: 0.6, shoal: 0.75 },
  { swell: false, dir: [0.96, -0.28], length: 0.4, amp: 0.36, shoal: 0.5 },
] as const;
/** The surface never folds over: Σ q·k·a stays under this. */
const MAX_STEEP = 0.9;
const TAU = 6.2831853;
/** A phase wrapped to one turn, as the shader's waterPhase does. */
export const wrapPhase = (v: number) => v - TAU * Math.floor(v / TAU);

/**
 * The trains for a params block at world time `t`, `count` of them, as the shader's two vec4 arrays take them (packed
 * here, 8 floats a train): A = (dir x, dir z, k, ω·t wrapped), B = (height, q, shoal depth, the shallow lag's phase).
 * The time phase is wrapped here in doubles and handed over, so the GPU never multiplies a day of seconds in floats.
 */
export function waveTable(p: WaveParams, t: number, count = WAVE_MAX, out: Float32Array = new Float32Array(WAVE_MAX * 8)): Float32Array {
  const n = Math.max(0, Math.min(WAVE_MAX, count));
  const k1 = TAU / Math.max(p.waveScale, 0.001);
  let steep = 0;
  for (let i = 0; i < WAVE_MAX; i++) {
    const tr = TRAINS[i], o = i * 8;
    if (i >= n) { out.fill(0, o, o + 8); continue; }
    const l = Math.hypot(tr.dir[0], tr.dir[1]);
    const k = tr.swell ? TAU / Math.max(p.swellLength, 0.001) : k1 / tr.length;
    // Deep-water dispersion within the wind sea (ω ∝ √k): a shorter wave runs slower. The swell keeps its own clock.
    const w = tr.swell ? p.swellSpeed : p.waveSpeed * Math.sqrt(k / k1);
    const a = tr.swell ? p.swellHeight * tr.amp : p.waveHeight * tr.amp;
    const q = tr.swell ? 1 : p.waveSteepness;
    out[o] = tr.dir[0] / l; out[o + 1] = tr.dir[1] / l; out[o + 2] = k; out[o + 3] = wrapPhase(w * t);
    out[o + 4] = a; out[o + 5] = q; out[o + 6] = tr.shoal; out[o + 7] = w * p.waveShoalLag;
    steep += q * k * a;
  }
  // Too steep a bench setting: every train's q eased down together until the surface can't loop.
  if (steep > MAX_STEEP) for (let i = 0; i < n; i++) out[i * 8 + 5] *= MAX_STEEP / steep;
  return out;
}

/** The sea's waves this frame, as the shader has them (advanceWaves writes it with the uniforms): the table, how many trains, the world time. */
export interface WaveState { table: Float32Array; count: number; t: number }
export const liveWaves: WaveState = { table: new Float32Array(WAVE_MAX * 8), count: 0, t: 0 };
/** Build this frame's table into `liveWaves` (terrainMaterials advanceWater copies it into the uniforms). */
export function advanceWaves(p: WaveParams, t: number, count: number): WaveState {
  waveTable(p, t, count, liveWaves.table);
  liveWaves.count = Math.min(WAVE_MAX, count);
  liveWaves.t = t;
  return liveWaves;
}
/** A standalone state (tests, a bench): its own table. */
export const waveState = (p: WaveParams, t: number, count = WAVE_MAX): WaveState => ({ table: waveTable(p, t, count), count: Math.min(WAVE_MAX, count), t });

/**
 * The bound on the surface's slope (tan) anywhere: Σ k·a over the crest's compression (1 − Σ q·k·a). For the sun on
 * the water (GridOcean.test: no sparkle can tilt far enough to mirror a sun behind the camera).
 */
export function waveSlopeBound(p: WaveParams, count = WAVE_MAX): number {
  const tb = waveTable(p, 0, count);
  let slope = 0, steep = 0;
  for (let i = 0; i < count; i++) { slope += tb[i * 8 + 2] * tb[i * 8 + 4]; steep += tb[i * 8 + 5] * tb[i * 8 + 2] * tb[i * 8 + 4]; }
  return slope / Math.max(1 - steep, 0.05);
}

/**
 * THE wave function, GLSL. Scalar maths and component access only, so the test can run this very text in JS
 * (waves.test.ts) against `waterWaves` below. At rest point (x, z) with the bed `depth` under the still surface, the
 * field's `calm` and the mesh's vertex `spacing` there: the displacement into `disp`, the surface's slope (∂h/∂x,
 * ∂h/∂z) into `grad`, and returned the crests' compression (Σ q·k·a·sin θ: the crest foam reads it).
 */
export const WAVE_FN = /* glsl */ `
float waterWaves(float x, float z, float depth, float calm, float spacing, out vec3 disp, out vec2 grad) {
  float dx = 0.0;
  float dy = 0.0;
  float dz = 0.0;
  float gx = 0.0;
  float gz = 0.0;
  float squeeze = 0.0;
  for (int i = 0; i < ${WAVE_MAX}; i++) {
    if (float(i) >= uWaveCount) break;
    vec4 a = uWaveA[i];
    vec4 b = uWaveB[i];
    float shoal = smoothstep(0.0, b.z, depth);
    float amp = b.x * calm * shoal * (1.0 - smoothstep(0.34, 0.5, spacing * a.z * 0.15915494));
    float th = a.z * (a.x * x + a.y * z) - a.w + b.w * (1.0 - shoal);
    float s = sin(th);
    float c = cos(th);
    float ka = a.z * amp;
    dx += b.y * amp * a.x * c;
    dz += b.y * amp * a.y * c;
    dy += amp * s;
    gx += a.x * ka * c;
    gz += a.y * ka * c;
    squeeze += b.y * ka * s;
  }
  disp.x = dx;
  disp.y = dy;
  disp.z = dz;
  float up = max(1.0 - squeeze, 0.05);
  grad.x = gx / up;
  grad.y = gz / up;
  return squeeze;
}
`;

/** WAVE_FN on the CPU, line for line. `table`/`count` as waveTable packs them; `disp` and `grad` written. */
export function waterWaves(table: Float32Array, count: number, x: number, z: number, depth: number, calm: number, spacing: number,
  disp: { x: number; y: number; z: number }, grad: { x: number; z: number }): number {
  let dx = 0, dy = 0, dz = 0, gx = 0, gz = 0, squeeze = 0;
  for (let i = 0; i < WAVE_MAX; i++) {
    if (i >= count) break;
    const o = i * 8;
    const ax = table[o], az = table[o + 1], k = table[o + 2], ph = table[o + 3];
    const height = table[o + 4], q = table[o + 5], deep = table[o + 6], lag = table[o + 7];
    const shoal = smooth(0, deep, depth);
    const amp = height * calm * shoal * (1 - smooth(0.34, 0.5, spacing * k * 0.15915494));
    const th = k * (ax * x + az * z) - ph + lag * (1 - shoal);
    const s = Math.sin(th), c = Math.cos(th), ka = k * amp;
    dx += q * amp * ax * c;
    dz += q * amp * az * c;
    dy += amp * s;
    gx += ax * ka * c;
    gz += az * ka * c;
    squeeze += q * ka * s;
  }
  disp.x = dx; disp.y = dy; disp.z = dz;
  const up = Math.max(1 - squeeze, 0.05);
  grad.x = gx / up;
  grad.z = gz / up;
  return squeeze;
}
/** GLSL's smoothstep. */
export function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** The water field at a point as the waves read it: the bed's depth under the still surface and the calm. */
export interface WaveField { depth: number; calm: number }
/** Where the field comes from on the CPU (lib/game/waterField.ts, the same data the shader samples); none: the open deep sea. */
export type FieldAt = (x: number, z: number, out: WaveField) => WaveField;
const deepSea: FieldAt = (_x, _z, out) => { out.depth = 1e3; out.calm = 1; return out; };

const _f: WaveField = { depth: 0, calm: 0 }, _d = { x: 0, y: 0, z: 0 };
/**
 * The surface at WORLD point (x, z), for what floats on it: its height over the still water (returned) and its slope
 * into `grad`. The shader moves each rest point by its displacement, so the surface over (x, z) is the one whose rest
 * point plus displacement lands there: found by fixed-point steps (the displacement is a small fraction of a
 * wavelength, so three steps put it within a hair).
 */
export function waterWaveAt(x: number, z: number, w: WaveState, grad: { x: number; z: number } = { x: 0, z: 0 }, field: FieldAt = deepSea, out?: { x: number; z: number }): number {
  let rx = x, rz = z;
  for (let i = 0; i < 3; i++) {
    field(rx, rz, _f);
    waterWaves(w.table, w.count, rx, rz, _f.depth, _f.calm, 0, _d, grad);
    rx = x - _d.x; rz = z - _d.z;
  }
  field(rx, rz, _f);
  waterWaves(w.table, w.count, rx, rz, _f.depth, _f.calm, 0, _d, grad);
  if (out) { out.x = rx; out.z = rz; }
  return _d.y;
}
