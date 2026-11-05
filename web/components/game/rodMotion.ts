/**
 * How each rod moves in its awakening (RodAwakening; David 2026-11-05: "the tidewarden should get wave animation and
 * shouldnt be a stagnant rod, orb shoul grow in size etc."), and how strong each beat of the cutscene is. Plain numbers,
 * so the cutscene's frame loop only applies them.
 */
import type { AwakenPhase } from "@/components/gui/flat";
import { fxAt } from "@/lib/game/fx/library";

/**
 * One frame of a rod's motion, on top of the stage's turn: lifted `y` and slid `x` (stage units), rolled `roll` and
 * tipped `tip` (rad), twirling `twirl` (rad/s, about its own up), a `flash` of extra glow on the rod (a storm's
 * lightning), and `sheen` (0 to 1, bottom to top) where a band of light runs up it, or null for none.
 */
export interface Pose { x: number; y: number; roll: number; tip: number; twirl: number; flash: number; sheen: number | null }
/** A rod's motion at `t` seconds, `e` its energy (0 at rest, about 1 at the cutscene's height). */
export type Move = (t: number, e: number) => Pose;

const REST: Pose = { x: 0, y: 0, roll: 0, tip: 0, twirl: 0, flash: 0, sheen: null };
/** A lightning stroke now and then: a fresh chance every fifth of a second, each one fading over its fifth. */
const strike = (t: number) => { const k = Math.floor(t * 5); return Math.abs(Math.sin(k * 12.9898) * 43758.5453 % 1) > 0.8 ? 1 - (t * 5 - k) : 0; };

export const MOVES: Record<string, Move> = {
  // It lifts and twirls, quicker the more it gathers: a plain rod finding its feet.
  rod_training: (t, e) => ({ ...REST, y: 0.05 * e, roll: 0.06 * e * Math.sin(t * 1.6), twirl: 5 * e * e }),
  // Heavy and level: it rises slowly, hardly rocks, and a band of light runs up its steel.
  rod_titanium: (t, e) => ({ ...REST, y: 0.05 * e, roll: 0.025 * e * Math.sin(t * 0.8), sheen: e > 0.05 ? (t * 0.6) % 1 : null }),
  // It rides a swell: rising and falling, rolling with each wave a moment behind it, drifting with the tide.
  rod_tidewarden: (t, e) => ({ ...REST, x: 0.03 * e * Math.sin(t * 1.2 + 0.5), y: 0.07 * e * Math.sin(t * 2.4), roll: 0.2 * e * Math.sin(t * 2.4 - 1.1),
    tip: 0.1 * e * Math.sin(t * 1.2) }),
  // Gusts: it leans and whips in the wind, shakes under each gust, and lightning flashes on it.
  rod_tempest: (t, e) => {
    const gust = 0.5 + 0.5 * Math.sin(t * 1.3);
    return { ...REST, x: 0.025 * e * gust * Math.sin(t * 23), y: 0.03 * e * Math.sin(t * 1.7), roll: e * (0.16 * gust * Math.sin(t * 4.1) + 0.03 * Math.sin(t * 29)),
      flash: e * strike(t) };
  },
};
/** A rod with no motion of its own moves as the Training rod does. */
export const moveOf = (key: string): Move => MOVES[key] ?? MOVES.rod_training;

/**
 * Each beat's targets (the frame loop eases to them; the effects library's motion, glow and burst): `energy` the
 * rod's motion, `glow` the glow on the rod itself (its old rung's colour until the burst, then its new one's), `aura`
 * what its effect gains over its look's own strength.
 * The new form plays its motion alone at the `show`; at the `reveal` it is still, so what changed is the only thing moving.
 */
export const BEAT: Record<AwakenPhase, { energy: number; glow: number; aura: number }> = {
  frame: { energy: 0.1, glow: 0, aura: 0 },
  glow: { energy: 0.45, glow: 0.75, aura: 0.5 },
  pulse: { energy: 1, glow: 1, aura: 1 },
  burst: { energy: 1.25, glow: fxAt("burst", "peak"), aura: 1.6 },
  show: { energy: 1, glow: 0, aura: 1 },
  reveal: { energy: 0, glow: 0, aura: 0 },
};
/** An effect rod's aura at a look (0 as bought, 1 after its first awakening, ...): a little stronger each awakening. */
export const auraAt = (look: number) => 1 + 0.5 * look;
