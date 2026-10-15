/**
 * Character detail (specs/perf/2026-10-results.md; by situation since head-v10, row 311). David, 2026-10-14: "high def
 * when close up like for photo mode or clicking into profile, a medium when close in in combat and a low when zoomed
 * out". So the camera's situation picks the tier first (`DetailSituation`), then distance and drawn size:
 *
 * | Situation                                              | Mesh                                                    |
 * |--------------------------------------------------------|---------------------------------------------------------|
 * | the creator, the closet, the reflection creator        | Full always (Character `lod={false}`)                   |
 * | close: photo mode; a player whose card is open         | Full up close; the size rule below further out          |
 * | play: everything else, combat and you included         | LOD 1 at the nearest; LOD 2 zoomed out or past `far`    |
 *
 * The size rule (close): anything nearer the camera than the farthest the follow camera ever sits from you (`near`:
 * the orbit distance at the widest zoom) is drawn in full. Past that a character steps down only while it is also
 * small on screen, in drawn pixels (CSS pixels x the canvas's pixel ratio, so the pixel finish's half-resolution
 * canvas counts what it really draws). Animation and the sun shadow step down by size in every situation:
 *
 * | Past (camera distance)      | and drawn under | Mesh (close) | Animation          | Sun shadow                    |
 * |-----------------------------|-----------------|--------------|--------------------|-------------------------------|
 * | 21 u                        | 72 px           | LOD 1        | every frame        | yes                           |
 * | 28 u                        | 48 px           | LOD 1        | 30 Hz              | yes                           |
 * | 40 u                        | 28 px           | LOD 2        | 15 Hz              | yes                           |
 * | 40 u                        | 10 px           | LOD 2        | 15 Hz              | no (its contact shadow stays) |
 * | 21 u, out of view; hidden   |                 | LOD 1        | 5 Hz (state keeps) | no                            |
 *
 * LOD 2 (head-roblox, David 2026-10-14: "lower poly ... for hair when far"): the whole hairstyles at about 1,100 triangles
 * (art/characters/build_lod.py lod2/); every other part draws its LOD 1 there.
 *
 * Each line has hysteresis (15% on both measures, and on the zoom): a character crosses back only past it, so one
 * standing on a line never flickers. Pure: Character calls `characterLod` once a frame with what it measured.
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
  /** The LOD 2 mesh (the far hair) past this distance and under this height: the quarter line. */
  far: { distance: 40, px: 28 },
  /** No sun shadow past the quarter line's distance and under this height: a speck whose shadow is a speck. (A long
   * afternoon shadow reads from much further than the figure that casts it, so it goes last.) */
  shadowPx: 10,
  /** Off screen or hidden: the mixer steps at this rate (one-shots finish, footsteps count). */
  offHz: 5,
  /** Crossing back needs this much margin on both measures. */
  hysteresis: 1.15,
} as const;

/** The follow camera's zoom (orbitCamera: x the follow distance, 0.6 to 1.6; Z toggles 1 and 1.4) past which play draws LOD 2. */
export const ZOOMED_OUT = 1.3;

/** What the camera is doing for a character this frame (head-v10). */
export interface DetailSituation {
  /** Photo mode, or this character is a player whose card is open: Full up close. */
  close: boolean;
  /** The follow camera's zoom (orbitCamera `orbit.view.zoom`). */
  zoom: number;
}
/** The situation from photo mode, whether this character's card is open, and the follow camera's zoom. */
export function detailSituation({ photo, focused, zoom }: { photo: boolean; focused: boolean; zoom: number }): DetailSituation {
  return { close: photo || focused, zoom };
}
const CLOSE: DetailSituation = { close: true, zoom: 1 };

export interface LodState {
  /** Drawing the LOD 1 mesh. */
  lod: boolean;
  /** Drawing the LOD 2 mesh (implies `lod`). */
  lod2: boolean;
  /** Mixer steps a second (Infinity: every frame). */
  hz: number;
  /** Casts the sun shadow. */
  shadow: boolean;
  /** Animation time saved up since the mixer last stepped (seconds). */
  saved: number;
}
export const createLodState = (): LodState => ({ lod: false, lod2: false, hz: Infinity, shadow: true, saved: 0 });

/** Past `distance` and under `px` now: staying in needs only (distance / h, px x h), so leaving takes a 15% margin. */
function reduced(d: number, px: number, distance: number, line: number, was: boolean) {
  const h = was ? CHARACTER_LOD.hysteresis : 1;
  return d > distance / h && px < line * h;
}

/**
 * This frame's tier for a character `d` world units from the camera and `px` drawn pixels tall (`visible` false: off
 * screen or hidden), in situation `at`. Writes `s`.
 */
export function characterLod(s: LodState, d: number, px: number, visible = true, at: DetailSituation = CLOSE): LodState {
  const L = CHARACTER_LOD;
  // Out of view (or hidden: `d` Infinity) past `near`: nothing to see. Nearer, its sun shadow can still fall in view: full.
  if (!visible) {
    const far = d > L.near;
    s.lod = far || !at.close; s.lod2 = d > L.far.distance || (!at.close && at.zoom > ZOOMED_OUT); s.hz = far ? L.offHz : Infinity; s.shadow = !far;
    return s;
  }
  const farHair = reduced(d, px, L.far.distance, L.far.px, s.lod2);
  if (at.close) {
    s.lod = reduced(d, px, L.near, L.mesh, s.lod);
    s.lod2 = s.lod && farHair;
  } else {
    s.lod = true;
    s.lod2 = at.zoom > (s.lod2 ? ZOOMED_OUT / L.hysteresis : ZOOMED_OUT) || farHair;
  }
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
