/**
 * The world's slow motion while the tool wheel is open (specs/game-ui.md §1): the player and the ruins' encounter
 * run at SLOW speed, eased in and out over a moment (never a snap). A function of the clock, so every reader in a
 * frame sees the same value and nothing has to step it.
 */
export const SLOW = 0.3;
const EASE = 12; // per second
let from = 1, to = 1, at = 0;

/** Ask for slow motion (the wheel opened) or normal speed (it closed). */
export function slowMotion(on: boolean, now = performance.now()) {
  const next = on ? SLOW : 1;
  if (next === to) return;
  from = timeScale(now);
  to = next;
  at = now;
}
/** The world's speed now: 1 normal, SLOW with the wheel open. */
export function timeScale(now = performance.now()): number {
  return to + (from - to) * Math.exp(-EASE * Math.max(0, now - at) / 1000);
}
