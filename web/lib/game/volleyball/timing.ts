/**
 * Timing (specs/minigames/beach-volleyball.md §4, §5): the serve's power bar, the serve's timing circle and the touch
 * windows. Pure.
 */
import { CAST } from "@/lib/game/fishing";
import { VB_FEEL } from "./feel";

/**
 * The power bar while held `held` seconds: the fishing cast meter's wave (FishingOverlay CastMeter), 0 → 1 → 0, the
 * first pass slow and each completed pass 15% quicker, up to 2.2×.
 */
export function meterPower(held: number): number {
  const cycle = CAST.cycleMs / 1000;
  let left = Math.max(0, held), mul = 1;
  while (left * mul >= cycle) { left -= cycle / mul; mul = Math.min(2.2, mul * 1.15); }
  const c = (left * mul) / cycle;
  return c < 0.5 ? c * 2 : (1 - c) * 2;
}

/** The serve's timing windows (s either side of the ideal). */
export const SERVE_WINDOW = { good: 0.09, perfect: 0.035 } as const;
export type ServeJudge = "perfect" | "good" | "early" | "late";
/** `err`: the click's time minus the ideal moment (negative: early). */
export function judgeServe(err: number): ServeJudge {
  const a = Math.abs(err);
  return a <= SERVE_WINDOW.perfect ? "perfect" : a <= SERVE_WINDOW.good ? "good" : err < 0 ? "early" : "late";
}

/**
 * The timing circle's error at a click: now minus when the falling ball's centre meets the hand at `handY`. Rising, or
 * above the hand: negative (early); below it: positive (late), as long as it has been below.
 */
export function serveError(ballY: number, ballVy: number, handY: number, g: number): number {
  const dy = ballY - handY;
  if (dy >= 0) {
    // Still to come down to the hand: the time until it does (rising first, if it is).
    return -((ballVy + Math.sqrt(ballVy * ballVy + 2 * g * dy)) / g);
  }
  // Below the hand: how long since it passed (it fell at the speed it has now, near enough).
  return -dy / Math.max(0.5, -ballVy);
}

/** A touch's quality, 0..1, from how far off the ideal moment (s) and how far off centre. */
export function touchQuality(timeOff: number, off: number, reach: number): number {
  const t = Math.min(1, Math.abs(timeOff) / VB_FEEL.timing.window), h = Math.min(1, off / reach);
  return Math.max(0, 1 - 0.6 * t - 0.4 * h * h);
}
export type Grade = "perfect" | "good" | "poor";
export const grade = (q: number): Grade => (q >= 0.8 ? "perfect" : q >= 0.5 ? "good" : "poor");
