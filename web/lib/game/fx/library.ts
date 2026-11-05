/**
 * The effects library (David 2026-11-05: "make a mini effect library that organizes types of effects and its a standard
 * so future vfx or effects and r eference and take the template"; specs/fx-library.md). Every effect on a rod, a tool
 * or a moment is built from these types: each says what it is, how it is authored (the Blender template in
 * art/pipeline/fx_library.py, a GLB name or extra, or code), its parameters as made, and what grows with its strength
 * (1 as made; RodAura `strength`, the awakening's beats). Previews: /lab/fx, clips in specs/evidence/rod-gear/r8/.
 *
 * The rules every effect keeps:
 *   - no circle or ring glows: light follows the thing's own shape (its Glow parts, an aura hugging it, the outline
 *     glow), never a disc sprite or a ring drawn round it (David 2026-11-05, the awakening and the Tempest);
 *   - colours come from the thing (its rung's or its material's), never plain white light;
 *   - one material per effect node, so each is one draw (specs/perf/effects-cost.md).
 */

export type FxKind = "glow" | "aura" | "particles" | "trail" | "pulse" | "motion" | "flicker" | "sparks" | "burst";

/** A parameter as made, what it does, and how much of it grows with strength (`value * (1 + grows * (k - 1))`). */
export interface FxParam { value: number; what: string; grows: number }
export interface FxType {
  name: string;
  /** What it is, in a line. */
  what: string;
  /** How it is made: the Blender template, the GLB's names and extras, or the code that draws it. */
  authored: string;
  params: Record<string, FxParam>;
}

const p = (value: number, what: string, grows = 0): FxParam => ({ value, what, grows });

export const FX: Record<FxKind, FxType> = {
  glow: {
    name: "Glow on the thing", what: "The thing's own parts lit from within, and a soft glow that follows its outline.",
    authored: "An effect part with a `Glow` material (fx_library.py glow_part: a copy of the part it lights, unlit); for a whole model in a moment, glowOn (lib/game/fx/glowOn.ts) and the kit's outline glow (Awakening).",
    params: { amount: p(1, "how bright, over its own colour", 0.6), outline: p(14, "the outline glow's reach on screen (px)", 0.5) },
  },
  aura: {
    name: "Aura", what: "A soft shell hugging the thing's shape, brightest where it faces you, fading to nothing at its edges, breathing.",
    authored: "A part with an `Aura` material shaped by fx_library.py aura_hug (the thing's main parts inflated along their normals), never a sphere or a spindle.",
    params: { opacity: p(0.55, "how strong where it faces you"), breathe: p(1.3, "breaths a second"), inflate: p(1.9, "how far it stands off the parts (times their radius)") },
  },
  particles: {
    name: "Particles", what: "Motes drifting up off the thing, now and then.",
    authored: "The effect GLB's scene extras: `spark` (colour), `sparkSprite` (glow or sparkle), `sparkEvery` (s), `sparkSize`, `sparkRise`; drawn in the scene's one glow pool (GlowFx).",
    params: { rate: p(1, "how often, times sparkEvery's", 1), size: p(0.06, "mote size (m)"), rise: p(0.3, "how far they drift up (m)") },
  },
  trail: {
    name: "Trail", what: "A fading ribbon behind a moving part.",
    authored: "A node with a `trail` extra (the ribbon's width, m) and `trailFrom` (the point it trails, in the node's space); RodAura draws the ribbon in the part's own colour, additive.",
    params: { length: p(0.4, "how long it lasts (s)", 0.5), width: p(0.012, "how wide (m)") },
  },
  pulse: {
    name: "Pulse", what: "A part swelling and easing back; with strength the whole part grows (the Tidewarden's pearl).",
    authored: "A node's `pulse` extra (the swell, a share of its size).",
    params: { swell: p(0.08, "the swell, a share of its size"), rate: p(2.6, "rad/s"), size: p(1, "its size", 0.45) },
  },
  motion: {
    name: "Motion", what: "A part turning, bobbing or orbiting; a moment's whole-thing motion (rodMotion).",
    authored: "A node's `spin` (rad/s about its own up), `bob` (m) and `rate` (Hz) extras; a cutscene's own motion in components/game/rodMotion.ts.",
    params: { spin: p(1, "turn speed, times its own", 1), bob: p(1, "bob height, times its own", 1) },
  },
  flicker: {
    name: "Flicker", what: "Light crackling: a fresh brightness sixteen times a second, a little jitter in its shape.",
    authored: "A node's `flicker` extra (0 to 1) on a `Glow` part (lightning, a fizzing fuse).",
    params: { amount: p(1, "how deep the crackle goes"), steps: p(16, "changes a second") },
  },
  sparks: {
    name: "Sparks", what: "A one-off spray of sparks flying off the thing and fading.",
    authored: "sparkBurst (lib/game/fx/glowOn.ts) into the scene's glow pool, from the thing's own parts.",
    params: { count: p(18, "sparks", 0.6), speed: p(0.9, "m/s"), life: p(0.9, "s") },
  },
  burst: {
    name: "Burst", what: "A one-off flare: the glow peaks and turns its new colour, the screen takes that colour a moment, then clears.",
    authored: "A moment's beat (the kit's Awakening `burst`): the outline glow to its peak, a full-screen tint in the colour, no shape and no edge.",
    params: { peak: p(1.4, "the glow's peak, times its amount"), tint: p(0.32, "the screen tint's strength"), ms: p(650, "how long") },
  },
};

/** `kind`'s `param` at strength `k` (1 as made). */
export const fxAt = (kind: FxKind, param: string, k = 1): number => {
  const q = FX[kind].params[param];
  return q.value * (1 + q.grows * (k - 1));
};
/** How much a param grows at strength `k`, as a factor (1 as made). */
export const fxGrow = (kind: FxKind, param: string, k = 1): number => 1 + FX[kind].params[param].grows * (k - 1);
