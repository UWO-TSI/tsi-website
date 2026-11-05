/**
 * The island's one wind (sky-ambient round 3, specs/sky-ambient.md §R3; round 1's approved pitch, built). One
 * direction (worldFx WIND_DIR, the prevailing wind the rain, the leaves, the mist and the clouds already ride), a
 * strength the weather sets, a slow swell, and gust fronts: bands of stronger air rolling downwind across the island at
 * FRONT_SPEED, FRONT_SPACING apart, bowed along their length and each its own strength. The grass bows as a front
 * crosses it, the trees lean into it, and the wind's marks (AmbienceFX WindMarks: streaks, curls, blown leaves, sand)
 * show only where a front is passing. Everything is a function of the world clock, so every client sees the same
 * fronts at the same moment.
 */

import type { IslandWeather } from "./islandWeather";
import { WIND_DIR, hash01 } from "./worldFx";

/** How hard the wind blows per weather: 1 is a clear day's breeze. */
export const WIND_STRENGTH: Record<IslandWeather, number> = { clear: 1, fog: 0.35, rain: 2.2, snow: 1.4, wind: 3 };
/**
 * The gust fronts: world units apart, world units a second, the share of the gap the rise to a crest takes and the
 * share the ease off behind it takes, fronts before their strengths repeat.
 */
export const FRONT_SPACING = 46, FRONT_SPEED = 8, FRONT_CREST = 0.06, FRONT_TAIL = 0.42, FRONT_CYCLE = 16;

/** The live wind (written by IslandAtmosphere's WindDriver each frame; still air's defaults where nothing drives it). */
export const WIND = { x: WIND_DIR.x, z: WIND_DIR.z, strength: 1, swell: 1 };

/** A slow swell on the world clock, 0.7 to 1.3: three incommensurate waves, so the wind breathes rather than pulses. */
export function swellAt(t: number): number {
  const g = Math.sin(t * 0.23) + 0.6 * Math.sin(t * 0.57 + 1.3) + 0.3 * Math.sin(t * 1.7 + 0.4);
  return 1 + 0.3 * (g / 1.9);
}

/** Where the fronts are at world time `t`: a phase in fronts, wrapped at FRONT_CYCLE (small, so the GPU keeps it exact). */
export const frontPhase = (t: number) => (((t * FRONT_SPEED) / FRONT_SPACING) % FRONT_CYCLE + FRONT_CYCLE) % FRONT_CYCLE;

/** How far along the fronts' march (x, z) sits, in fronts: downwind, bowed along each front's length. */
function along(x: number, z: number): number {
  const a = (x * WIND_DIR.x + z * WIND_DIR.z) / FRONT_SPACING, across = -x * WIND_DIR.z + z * WIND_DIR.x;
  return a + 0.18 * Math.sin(across / 31 + 1.7) + 0.1 * Math.sin(across / 13);
}
/** Front `k`'s strength (period FRONT_CYCLE): some strong, some gentle. */
const frontAmp = (k: number) => 0.62 + 0.38 * Math.sin(((((k % FRONT_CYCLE) + FRONT_CYCLE) % FRONT_CYCLE) * Math.PI * 2 * 5) / FRONT_CYCLE);

/**
 * How much of a gust front is over (x, z) at the fronts' `phase` (frontPhase), 0..1: a quick rise as its crest nears,
 * a long ease off behind it. `a` falls as the fronts march; each whole number it crosses is a crest.
 */
export function frontAt(x: number, z: number, phase: number): number {
  const a = along(x, z) - phase, n = Math.floor(a), f = a - n;
  return f < FRONT_CREST ? (1 - smooth(0, FRONT_CREST, f)) * frontAmp(n) : smooth(1 - FRONT_TAIL, 1, f) * frontAmp(n + 1);
}

/**
 * The last front to reach (x, z) by world time `t`: seconds since its crest passed, and which front it is (every
 * client agrees on the number, for deciding what it stirs up there).
 */
export function lastFront(x: number, z: number, t: number, out: FrontPass = { since: 0, front: 0 }): FrontPass {
  const a = along(x, z) - (t * FRONT_SPEED) / FRONT_SPACING, k = Math.floor(a) + 1;
  out.since = ((k - a) * FRONT_SPACING) / FRONT_SPEED;
  out.front = k;
  return out;
}
export interface FrontPass { since: number; front: number }

/** Whether front `front` stirs a mark at spot `i`, for a share `chance` of the spots it crosses. */
export const stirs = (i: number, front: number, chance: number) => hash01(i * 7 + 3, front) < chance;

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** `frontAt` for the shaders: `windFront(xz, phase)`. */
export const FRONT_GLSL = /* glsl */ `
float windFront(vec2 p, float phase) {
  vec2 dir = vec2(${WIND_DIR.x.toFixed(6)}, ${WIND_DIR.z.toFixed(6)});
  float across = -p.x * dir.y + p.y * dir.x;
  float a = dot(p, dir) / ${FRONT_SPACING.toFixed(1)} + 0.18 * sin(across / 31.0 + 1.7) + 0.1 * sin(across / 13.0) - phase;
  float n = floor(a), f = a - n;
  float amp0 = 0.62 + 0.38 * sin(mod(n, ${FRONT_CYCLE.toFixed(1)}) * ${((Math.PI * 2 * 5) / FRONT_CYCLE).toFixed(6)});
  float amp1 = 0.62 + 0.38 * sin(mod(n + 1.0, ${FRONT_CYCLE.toFixed(1)}) * ${((Math.PI * 2 * 5) / FRONT_CYCLE).toFixed(6)});
  return f < ${FRONT_CREST.toFixed(3)} ? (1.0 - smoothstep(0.0, ${FRONT_CREST.toFixed(3)}, f)) * amp0 : smoothstep(${(1 - FRONT_TAIL).toFixed(3)}, 1.0, f) * amp1;
}
`;
