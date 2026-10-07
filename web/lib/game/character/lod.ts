/**
 * Character detail by distance and drawn size (specs/perf/2026-10-results.md). Up close nothing changes: anything
 * nearer the camera than the farthest the follow camera ever sits from you (`near`: the orbit distance at the widest
 * zoom) is drawn in full, so you, whoever you stand with and everyone in a room always are. Past that a character
 * steps down only while it is also small on screen, in drawn pixels (CSS pixels x the canvas's pixel ratio, so the
 * pixel finish's half-resolution canvas counts what it really draws):
 *
 * | Past (camera distance)      | and drawn under | Mesh  | Animation          | Sun shadow                    |
 * |-----------------------------|-----------------|-------|--------------------|-------------------------------|
 * | 21 u                        | 72 px           | LOD 1 | every frame        | yes                           |
 * | 28 u                        | 48 px           | LOD 1 | 30 Hz              | yes                           |
 * | 40 u                        | 28 px           | LOD 1 | 15 Hz              | yes                           |
 * | 40 u                        | 10 px           | LOD 1 | 15 Hz              | no (its contact shadow stays) |
 * | 21 u, out of view; hidden   |                 | LOD 1 | 5 Hz (state keeps) | no                            |
 *
 * Each line has hysteresis (15% on both measures): a character crosses back only past it, so one standing on a line
 * never flickers. Pure: Character calls `characterLod` once a frame with what it measured.
 */
export const CHARACTER_LOD = {
  /** Never reduced nearer the camera than this (orbitCamera ORBIT_DISTANCE x ZOOM_MAX). */
  near: 21,
  /** The LOD 1 mesh past `near` and under this drawn height. */
  mesh: 72,
  /** Animation at 30 Hz past this distance and under this height. */
  half: { distance: 28, px: 48 },
  /** Animation at 15 Hz past this distance and under this height. */
  quarter: { distance: 40, px: 28 },
  /** No sun shadow past the quarter line's distance and under this height: a speck whose shadow is a speck. (A long
   * afternoon shadow reads from much further than the figure that casts it, so it goes last.) */
  shadowPx: 10,
  /** Off screen or hidden: the mixer steps at this rate (one-shots finish, footsteps count). */
  offHz: 5,
  /** Crossing back needs this much margin on both measures. */
  hysteresis: 1.15,
} as const;

export interface LodState {
  /** Drawing the LOD 1 mesh. */
  lod: boolean;
  /** Mixer steps a second (Infinity: every frame). */
  hz: number;
  /** Casts the sun shadow. */
  shadow: boolean;
  /** Animation time saved up since the mixer last stepped (seconds). */
  saved: number;
}
export const createLodState = (): LodState => ({ lod: false, hz: Infinity, shadow: true, saved: 0 });

/** Past `distance` and under `px` now: staying in needs only (distance / h, px x h), so leaving takes a 15% margin. */
function reduced(d: number, px: number, distance: number, line: number, was: boolean) {
  const h = was ? CHARACTER_LOD.hysteresis : 1;
  return d > distance / h && px < line * h;
}

/**
 * This frame's tier for a character `d` world units from the camera and `px` drawn pixels tall (`visible` false: off
 * screen or hidden). Writes `s`.
 */
export function characterLod(s: LodState, d: number, px: number, visible = true): LodState {
  const L = CHARACTER_LOD;
  // Out of view (or hidden: `d` Infinity) past `near`: nothing to see. Nearer, its sun shadow can still fall in view: full.
  if (!visible) { const far = d > L.near; s.lod = far; s.hz = far ? L.offHz : Infinity; s.shadow = !far; return s; }
  s.lod = reduced(d, px, L.near, L.mesh, s.lod);
  const half = reduced(d, px, L.half.distance, L.half.px, s.hz <= 30), quarter = reduced(d, px, L.quarter.distance, L.quarter.px, s.hz <= 15);
  s.hz = quarter ? 15 : half ? 30 : Infinity;
  s.shadow = !reduced(d, px, L.quarter.distance, L.shadowPx, !s.shadow);
  return s;
}

/**
 * Whether the mixer steps this frame, given `dt` of animation time since the last frame: time is saved up and stepped
 * at once at the tier's rate (at most 0.2 s, as Character caps a frame). Returns the time to step, or 0 to skip.
 */
export function mixerStep(s: LodState, dt: number): number {
  s.saved += dt;
  if (s.hz !== Infinity && s.saved < 1 / s.hz) return 0;
  const step = Math.min(s.saved, 0.2);
  s.saved = 0;
  return step;
}

/** A character's drawn height in pixels: `height` world units at `distance` from a camera of vertical `fov` (degrees). */
export function drawnHeight(height: number, distance: number, fovDeg: number, viewportPx: number): number {
  return (height * viewportPx) / (2 * Math.max(distance, 1e-3) * Math.tan((fovDeg * Math.PI) / 360));
}
