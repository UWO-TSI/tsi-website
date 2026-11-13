/**
 * How each rod moves in its awakening (RodAwakening; David 2026-11-05: "the tidewarden should get wave animation and
 * shouldnt be a stagnant rod, orb shoul grow in size etc."), and how strong each beat of the cutscene is. Plain numbers,
 * so the cutscene's frame loop only applies them.
 */
import type { AwakenPhase } from "@/components/gui/flat";
import type { AwSfx } from "@/lib/game/audio";
import type { StrikeKind } from "@/lib/game/fx/holder";
import { fxAt, type FxKind } from "@/lib/game/fx/library";

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
 * Each beat's targets (the frame loop eases to them; the effects library's motion, glow, gather and burst): `energy`
 * the rod's motion, `glow` the glow on the rod itself (its old rung's colour until the burst, then its new one's),
 * `aura` what its effect gains over its look's own strength, `shake` how hard it trembles (rad), `gather` the light
 * drawn in to it (the gather type's strength, 0 for none).
 * The suspense (David 2026-11-06: "more suspense"): it trembles harder and draws more light in through the pulse, then
 * in the `hush` it goes still and dim, holding its breath, before the hit. The new form plays its motion alone at the
 * `show`; at the `reveal` it is still, so what changed is the only thing moving.
 */
export const BEAT: Record<AwakenPhase, { energy: number; glow: number; aura: number; shake: number; gather: number }> = {
  frame: { energy: 0.1, glow: 0, aura: 0, shake: 0, gather: 0 },
  glow: { energy: 0.45, glow: 0.75, aura: 0.5, shake: 0.004, gather: 0.15 },
  pulse: { energy: 1, glow: 1, aura: 1, shake: 0.03, gather: 0.3 },
  hush: { energy: 0.04, glow: 0.2, aura: 0, shake: 0.008, gather: 0 },
  burst: { energy: 1.25, glow: fxAt("burst", "peak"), aura: 1.6, shake: 0, gather: 0 },
  show: { energy: 1, glow: 0, aura: 1, shake: 0, gather: 0 },
  reveal: { energy: 0, glow: 0, aura: 0, shake: 0, gather: 0 },
};

/**
 * The light gathering in at a beat, `beat` the pulse's beats so far (David 2026-11-06 on the Training rod: "make the
 * particle gather small and slow and ramp up"): a trickle through the glow, building on every beat of the pulse to about
 * three times the type's own by its last, then none in the hush, while the last of it arrives.
 */
export const gatherAt = (phase: AwakenPhase, beat: number) => BEAT[phase].gather + (phase === "pulse" ? 0.12 * beat : 0);

/**
 * What acts on a rod from outside when its awakening brings it a new look or a new effect (David 2026-11-06: "if its a
 * new model or new effect external things will attach like a lighting related will strike it with thunder"): the
 * strike (lightning: lib/game/fx/holder.ts) gathers in the hush and lands on the burst, with its sound, and `wears`
 * the library types its new form wears from the burst on. `strength` is its new form's own effect at each beat (`beat`
 * the pulse's beats so far), in place of its look's own and the beat's. A rod not listed awakens without one (the
 * Training rod's is a new finish).
 */
export const AWAKEN_FX: Record<string, { strike?: StrikeKind; sound: AwSfx; soundAt: "hush" | "burst"; wears?: FxKind[]; strength?: (phase: AwakenPhase, beat: number) => number }> = {
  // the storm rod: struck by lightning (the thunder's crack is the hit), and the lightning stays on it, crawling over the chain
  rod_tempest: { strike: "lightning", sound: "aw-thunder", soundAt: "burst", wears: ["electricity"] },
  // the sea rod (David 2026-11-06: "have the rod not have the wave wrapped aound and the the animation is that the waves
  // wrap around the rod"): its awakened model's water is gated down the shaft (build_rods.py tidewarden), so its
  // strength winds it on. On each beat of the pulse the new form shows the water a little further down; the hush draws
  // it off (its sound rushes in); on the hit it crashes round the whole rod, runs hard while it shows, and settles.
  rod_tidewarden: { sound: "aw-wave", soundAt: "hush", strength: (phase, beat) => (TIDE[phase] ?? 1 + 0.012 * beat) / TIDE_MADE },
};
/** The Tidewarden's water at each beat, as the water's own strength (none under 1, all of the wrap from 1.45), and the
 * strength its awakened effect is drawn at as made (its `fxStrength`, which RodAura multiplies in). */
const TIDE: Partial<Record<AwakenPhase, number>> = { frame: 0.6, glow: 0.6, hush: 0.7, burst: 1.8, show: 2.3, reveal: 1.5 }, TIDE_MADE = 1.5;
/** An effect rod's aura at a look (0 as bought, 1 after its first awakening, ...): a little stronger each awakening. */
export const auraAt = (look: number) => 1 + 0.5 * look;
