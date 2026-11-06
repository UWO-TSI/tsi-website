/**
 * The effects library (David 2026-11-05: "make a mini effect library that organizes types of effects and its a standard
 * so future vfx or effects and r eference and take the template"; specs/fx-library.md). Every effect on a rod, a tool
 * or a moment is built from these types: each says what it is, how it is authored (the Blender template in
 * art/pipeline/fx_library.py, a GLB name or extra, or code), its parameters as made, and what grows with its strength
 * (1 as made; RodAura `strength`, the awakening's beats). Every type but Water and Sway is also drawn by code on any
 * holder (components/game/fx/HolderFx.tsx, lib/game/fx/holder.ts: a rod, a sword, a hat), round 10 (David 2026-11-06:
 * "this wont only be for fishing rod but for weapon, vfx clothes etc"). Previews: /lab/fx?type=<kind>, one at a time.
 *
 * The rules every effect keeps:
 *   - no circle or ring glows: light follows the thing's own shape (its Glow parts, an aura hugging it, the outline
 *     glow), never a disc sprite or a ring drawn round it (David 2026-11-05, the awakening and the Tempest);
 *   - colours come from the thing (its rung's or its material's), never plain white light;
 *   - one material per effect node, so each is one draw (specs/perf/effects-cost.md).
 */

export type FxKind = "glow" | "aura" | "particles" | "trail" | "pulse" | "motion" | "flicker" | "sparks" | "burst" | "water"
  | "electricity" | "embers" | "flame" | "petals" | "gather" | "sway";

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
    authored: "An effect part with a `Glow` material (fx_library.py glow_part: a copy of the part it lights, unlit); on any holder, HolderFx's glow shell (a band of light running up it, breathing); for a whole model in a moment, glowOn (lib/game/fx/glowOn.ts) and the kit's outline glow (Awakening).",
    params: { amount: p(1, "how bright, over its own colour", 0.6), outline: p(14, "the outline glow's reach on screen (px)", 0.5) },
  },
  aura: {
    name: "Aura", what: "A soft shell hugging the thing's shape, brightest where it faces you, fading to nothing at its edges, breathing.",
    authored: "A part with an `Aura` material shaped by fx_library.py aura_hug (the thing's main parts inflated along their normals), never a sphere or a spindle; on any holder, HolderFx's aura shell (its own shape inflated, tongues of light licking up it, cel bands).",
    params: { opacity: p(0.55, "how strong where it faces you"), breathe: p(1.3, "breaths a second"), inflate: p(1.9, "how far it stands off the parts (times their radius)") },
  },
  particles: {
    name: "Particles", what: "Motes drifting up off the thing, now and then.",
    authored: "The effect GLB's scene extras: `spark` (colour), `sparkSprite` (glow or sparkle), `sparkEvery` (s), `sparkSize`, `sparkRise`; drawn in the scene's one glow pool (GlowFx). On any holder: HolderFx motes off its surface.",
    params: { rate: p(1, "how often, times sparkEvery's", 1), size: p(0.06, "mote size (m)"), rise: p(0.3, "how far they drift up (m)") },
  },
  trail: {
    name: "Trail", what: "A fading ribbon behind a moving part.",
    authored: "A node with a `trail` extra (the ribbon's width, m) and `trailFrom` (the point it trails, in the node's space); RodAura draws the ribbon in the part's own colour, additive. On any holder: HolderFx sweeps a blade of light behind its outer half as it swings (the weapon trail's shader).",
    params: { length: p(0.4, "how long it lasts (s)", 0.5), width: p(0.012, "how wide (m)") },
  },
  pulse: {
    name: "Pulse", what: "A part swelling and easing back; with strength the whole part grows (the Tempest's tip spark).",
    authored: "A node's `pulse` extra (the swell, a share of its size); on any holder, HolderFx's glow shell beating, lub-dub.",
    params: { swell: p(0.08, "the swell, a share of its size"), rate: p(2.6, "rad/s"), size: p(1, "its size", 0.45) },
  },
  motion: {
    name: "Motion", what: "A part turning, bobbing or orbiting; a moment's whole-thing motion (rodMotion).",
    authored: "A node's `spin` (rad/s about its own up), `bob` (m) and `rate` (Hz) extras; a cutscene's own motion in components/game/rodMotion.ts; on any holder, HolderFx's three comets spiralling up round it with short tails.",
    params: { spin: p(1, "turn speed, times its own", 1), bob: p(1, "bob height, times its own", 1) },
  },
  flicker: {
    name: "Flicker", what: "Light crackling: a fresh brightness sixteen times a second, a little jitter in its shape.",
    authored: "A node's `flicker` extra (0 to 1) on a `Glow` part (lightning, a fizzing fuse); on any holder, HolderFx's glow shell crackling.",
    params: { amount: p(1, "how deep the crackle goes"), steps: p(16, "changes a second") },
  },
  sparks: {
    name: "Sparks", what: "A one-off spray of sparks flying off the thing and fading.",
    authored: "sparkRecipe (lib/game/fx/glowOn.ts) into the scene's glow pool, from the thing's own parts; on any holder, HolderFx: a flare and a burst of streaks at its tip, sparks off its surface.",
    params: { count: p(18, "sparks", 0.6), speed: p(0.9, "m/s"), life: p(0.9, "s") },
  },
  water: {
    name: "Water", what: "Water running along the thing: a deep teal-blue body with darker crests, foam breaking along its edges, a crown of foam crashing where it ends, drops flying off and falling.",
    authored: "fx_library.py water (a ribbon, its material `Water`), foam (meshes, `Foam`: each vertex's depth into the foam, a phase, a crown weight) and spray (drops, `Spray`); drawn by lib/game/fx/water.ts, flat colours with hard edges, one draw each.",
    params: {
      flow: p(0.35, "how fast it runs (widths a second)", 0.3), foam: p(0.13, "the edge foam's width (a share of the water's)", 0.5),
      wrap: p(1, "how far it reaches: as made at 1, the grown water (made to show only with strength) past it", 0.667),
      splashes: p(1, "the foam's hold and the drops thrown: the drops made to come with strength join in", 1),
    },
  },
  electricity: {
    name: "Electricity", what: "Lightning crawling over the thing: short jagged bolts jumping between points on it, re-struck sixteen times a second, a spark where each lands, now and then an arc out into the air.",
    authored: "Code on any holder (HolderFx): the library pack's bolt laid between two points of its surface in jagged pieces, its flare at the end.",
    params: { bolts: p(2, "bolts at once", 0.8), reach: p(0.22, "how far a bolt jumps (a share of its length)", 0.2), arcs: p(0.12, "the chance of an arc out, each strike", 1) },
  },
  embers: {
    name: "Fire sparks", what: "Fire sparks thrown off the thing in pulses, rising, flickering and drifting, a few between the pulses.",
    authored: "Code on any holder (HolderFx): the library pack's mote and spark burst through the fire ramp, from points on its surface.",
    params: { count: p(10, "sparks a pulse", 0.8), pulse: p(1.18, "pulses a second", 0.4) },
  },
  flame: {
    name: "Flame", what: "Flame licking up the thing: fire tongues all along it rising and tearing off at the tip, embers off the top.",
    authored: "Code on any holder (HolderFx): the library pack's looping fire tongue standing on points of its surface, through the fire ramp.",
    params: { rate: p(1, "tongues, times 42 a second", 0.7), height: p(1, "how tall they lick", 0.35) },
  },
  petals: {
    name: "Sakura petals", what: "Cherry petals letting go of the thing, tumbling, drifting on the breeze and fluttering down.",
    authored: "Code on any holder (HolderFx): the library pack's painted sakura petal (art/fx/build_pack.py), tumbling, through a pink ramp.",
    params: { rate: p(1, "petals, times 7 a second", 1) },
  },
  gather: {
    name: "Gather", what: "Light drawn in to the thing from all round, each mote arriving as it fades: the build-up before a moment.",
    authored: "Code on any holder (HolderFx): motes thrown at its surface from a ball round it.",
    params: { rate: p(30, "motes a second", 1) },
  },
  sway: {
    name: "Sway", what: "Soft parts (leaves, cloth, hair) swinging after the thing as it moves, like a spring, and stirring a little on their own.",
    authored: "A part with a `sway` extra (how far it swings, a share of its reach) in an effect GLB: RodAura springs it after its holder's motion, bending each vertex by its reach from the holder's axis.",
    params: { swing: p(1, "how far it swings", 0.5), stiffness: p(38, "the spring (1/s²)"), damping: p(5, "how fast it settles (1/s)") },
  },
  burst: {
    name: "Burst", what: "A one-off flare: the glow peaks and turns its new colour, the screen takes that colour a moment, then clears.",
    authored: "A moment's beat (the kit's Awakening `burst`: impact frames, then the outline glow to its peak and a full-screen tint in the colour, no shape and no edge); on any holder, HolderFx: its shell flares, a four-point flare and streaks.",
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
