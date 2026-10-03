/**
 * Going through a door (specs/polish/interiors.md deliverable 5): the fade lifts only when the room behind it is
 * ready, and Escape steps back out of a room once nothing else is open. Pure, so the order is tested.
 */

/** Frames the new scene renders, loaded, under the fade before it lifts (shaders compile, textures upload). */
export const WARMUP_FRAMES = 14;
/** A stuck or failing loader never traps you outside: after this the fade lifts anyway. */
export const WARMUP_TIMEOUT_MS = 15000;

/**
 * One frame of the warm-up count: frames rendered since everything finished loading. A loader starting again (a model
 * that suspends late) sends the count back to zero; past the time-out it counts regardless.
 */
export function warmupFrame(frames: number, loaded: boolean, timedOut: boolean): number {
  return loaded || timedOut ? frames + 1 : 0;
}
export const warmedUp = (frames: number) => frames >= WARMUP_FRAMES;

export type EscapeAction = "none" | "close" | "exit";
/**
 * What Escape does, in order: nothing while the browser's own Escape ended mouse-look or a door is mid-fade; close
 * what's open (a sheet or dialog, a decorating selection, the reveal card); and only in a room with nothing open,
 * leave it by its door.
 */
export function escapeAction(s: { captureEnded: boolean; fading: boolean; open: boolean; inside: boolean }): EscapeAction {
  if (s.captureEnded || s.fading) return "none";
  if (s.open) return "close";
  return s.inside ? "exit" : "close";
}
