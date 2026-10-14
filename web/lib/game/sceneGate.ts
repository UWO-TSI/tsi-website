/**
 * Going through a door (specs/polish/interiors.md deliverable 5): the fade lifts only when the room behind it is
 * ready, and what Escape does (the next Esc layer once nothing else is open). Pure, so the order is tested.
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

export type EscapeAction = "none" | "close" | "layer";
/**
 * What an Escape keydown does, in order: nothing while a door is mid-fade, or when the browser's own Escape just ended
 * mouse-look (the end of the lock opened the UI view: lib/game/escMenu.ts); close what's open (a decorating selection,
 * the reveal card; a sheet or dialog takes its own Escape); otherwise step to the next Esc layer, indoors as well
 * (David, playtest round 1: a room is left by its door). An Escape that reaches the page with the mouse still held
 * (fullscreen with the keyboard locked) steps on too.
 */
export function escapeAction(s: { captureEnded: boolean; locked: boolean; fading: boolean; open: boolean }): EscapeAction {
  if (s.fading) return "none";
  if (s.locked) return "layer";
  if (s.captureEnded) return "none";
  return s.open ? "close" : "layer";
}
