/**
 * Impact frames (design sheet §1.6): four tiers (light weapon hits, ability hits, heavy abilities and elite kills,
 * the ult), the ult's beat-by-beat sequence, the hitstop budget (the longest wins, never adding; at most 200 ms in any
 * second) and the flash limiter (one full-screen flash in any 1,000 ms, from any source: WCAG 2.3.1). Pure: the ruins
 * scene turns these numbers into hitstop, shake, FOV and slow motion, and the overlay pass (ImpactOverlay) into the
 * dim, the flash frame and the speed lines. Reduce flashing swaps in the right-hand column of §1.6.
 */
import type { ImpactTier } from "./runtime";

export interface HitImpact { hitstop: number; shake: number; fov: number; enemyFlash: number; lines: number; ring: boolean }
/** One hit's feel by tier: `melee` a weapon swing or a melee ability, `first` the first target of a ranged or area hit. */
export function hitImpact(tier: ImpactTier, melee: boolean, first: boolean, reduceFlashing = false): HitImpact {
  switch (tier) {
    case "light": return { hitstop: melee ? 0.06 : 0, shake: melee ? 0.035 : 0, fov: 0, enemyFlash: 0, lines: 0, ring: false };
    case "ability": return { hitstop: melee ? 0.07 : first ? 0.04 : 0, shake: 0.05, fov: 0, enemyFlash: 0, lines: 0, ring: false };
    case "heavy": return { hitstop: 0.1, shake: 0.1, fov: 1.5, enemyFlash: reduceFlashing ? 0.5 : 1, lines: 10, ring: true };
    case "ult": return { hitstop: 0, shake: 0, fov: 0, enemyFlash: 0, lines: 0, ring: false }; // the sequence (ultBeats) carries it
  }
}

/** Hitstop that merges: a new one extends to the longest asked for, and all of it stays under 200 ms in any second. */
export class HitstopBudget {
  private spent: { at: number; s: number }[] = [];
  /** `remaining`: hitstop already running; returns the hitstop to run from now (≥ remaining). */
  take(seconds: number, remaining: number, now: number): number {
    if (seconds <= remaining) return remaining;
    this.spent = this.spent.filter(x => now - x.at < 1);
    const used = this.spent.reduce((n, x) => n + x.s, 0), extra = Math.min(seconds - remaining, Math.max(0, 0.2 - used));
    if (extra > 0) this.spent.push({ at: now, s: extra });
    return remaining + extra;
  }
}

/** At most one full-screen flash in any 1,000 ms, from any source (two ults landing together still flash once). */
export class FlashLimiter {
  private last = -Infinity;
  allow(now: number): boolean {
    if (now - this.last < 1) return false;
    this.last = now;
    return true;
  }
}

/** What the ult sequence asks of the scene and the overlay at `t` seconds after the press, with anticipation `A` (§1.6 table). */
export interface UltBeats {
  /** How much the world outside the caster's 3 u circle dims (0.25 → 75% bright; 0.15 with Reduce flashing). */
  dim: number;
  /** FOV offset in degrees (−3 push-in through the anticipation, +5 at the freeze easing back). */
  fov: number;
  /** The hard freeze (the encounter, particles and animations stop). */
  freeze: boolean;
  /** The flash frame: high-contrast two-tone, or a 25% darken and desaturate with Reduce flashing. */
  flash: "full" | "reduced" | null;
  /** Radial speed lines: progress 0..1 (null: none) and their opacity. */
  lines: number | null; linesAlpha: number;
  /** World time scale (slow motion): 0.3 for 250 ms after the freeze, easing back to 1 over 200 ms. */
  slow: number;
  /** The heavy shake starts on this frame (once). */
  shake: boolean;
}
export const ULT_SEQ = { freeze: 0.12, flash: 0.05, lines: 0.35, linesFade: 0.15, shake: 0.35, kick: 0.15, shakeDecay: 9, fov: 5, fovBack: 0.4, slow: 0.3, slowHold: 0.25, slowEase: 0.2, end: 3 } as const;

const ease = (u: number) => u * u * (3 - 2 * u);
export function ultBeats(t: number, A: number, reduceFlashing = false, prevT = -1): UltBeats {
  const s = ULT_SEQ, after = t - A;
  const dimMax = reduceFlashing ? 0.15 : 0.25;
  const dim = after < 0 ? dimMax * ease(Math.min(1, t / Math.max(0.05, A))) : after < s.freeze + s.lines ? dimMax : dimMax * Math.max(0, 1 - (after - s.freeze - s.lines) / 0.3);
  let fov = after < 0 ? -3 * ease(Math.min(1, t / Math.max(0.05, A))) : 0;
  if (after >= s.freeze && after < s.freeze + s.fovBack) fov = s.fov * (1 - ease((after - s.freeze) / s.fovBack));
  else if (after >= 0 && after < s.freeze) fov = -3;
  const lines = after >= 0 && after < s.lines ? after / s.lines : null;
  const linesFade = lines === null ? 0 : Math.min(1, (s.lines - after) / s.linesFade);
  let slow = 1;
  const sa = after - s.freeze;
  if (sa >= 0 && sa < s.slowHold) slow = s.slow;
  else if (sa >= s.slowHold && sa < s.slowHold + s.slowEase) slow = s.slow + (1 - s.slow) * ease((sa - s.slowHold) / s.slowEase);
  return {
    dim, fov, freeze: after >= 0 && after < s.freeze,
    flash: after >= 0 && after < s.flash ? (reduceFlashing ? "reduced" : "full") : null,
    lines, linesAlpha: linesFade * (reduceFlashing ? 0.5 : 1),
    slow, shake: prevT - A < s.freeze && after >= s.freeze,
  };
}

/**
 * What the overlay pass draws this frame (the ruins scene writes it, ImpactOverlay reads it on its own animation
 * frame): the caster's screen spot and the radius of its 3 u clear circle, the impact's screen spot, the ult's colour,
 * the beats, and the ult-ready glow.
 */
export const impactView = {
  beats: null as UltBeats | null,
  /** The flash frame was allowed by the limiter (a full one); a refused one shows nothing. */
  flashOk: false,
  caster: { x: 0, y: 0, r: 0 }, hit: { x: 0, y: 0 },
  color: "#b48cff", ink: "#1d1a24",
  reduceFlashing: false,
  /** The meter just filled: the soft bottom-edge glow (not a flash), once. */
  readyAt: -Infinity,
};
