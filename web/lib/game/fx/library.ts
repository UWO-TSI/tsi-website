/**
 * The VFX library (David 2026-11-05: "make a mini effect library that organizes types of effects and its a standard
 * so future vfx or effects and r eference and take the template"; named 2026-11-06: "for auras and effects make it VFX
 * library"; specs/vfx-library.md). Every effect on a rod, a weapon, clothes or a moment is built from these types, in two
 * families (David: "theres like auras and effects"): auras, which he calls energy ("like neon with slight glow effect and
 * is like accessory parts and effect on parts"), worn on the thing's own parts; and effects, things that happen to it or
 * come off it. Each type says what it is, how it is made, its parameters as made, and what grows with its strength (1 as
 * made; RodAura `strength`, the awakening's beats). Every type but Sway is drawn by code on any holder
 * (components/game/fx/HolderFx.tsx, lib/game/fx/holder.ts: a rod, a sword, a hat). Previews: /lab/fx?type=<kind>.
 *
 * The rules every effect keeps:
 *   - no circle or ring glows: light follows the thing's own shape, never a disc sprite or a ring drawn round it
 *     (David 2026-11-05, the awakening and the Tempest);
 *   - colours come from the thing (its rung's or its material's), except where a type is a light of its own (the sun's
 *     glint, a white trail, fire, sparks, water);
 *   - one material per effect node, so each is one draw (specs/perf/effects-cost.md).
 */
export type FxKind = "energy" | "glow" | "pulse" | "particles" | "trail" | "motion" | "sparks" | "burst" | "water"
  | "electricity" | "embers" | "flame" | "petals" | "gather" | "sway";

/** The two families (David 2026-11-06): auras are worn on the thing's own parts; effects happen to it or come off it. */
export type FxFamily = "aura" | "effect";

/** A parameter as made, what it does, and how much of it grows with strength (`value * (1 + grows * (k - 1))`). */
export interface FxParam { value: number; what: string; grows: number }
export interface FxType {
  name: string;
  family: FxFamily;
  /** What it is, in a line. */
  what: string;
  /** How it is made: the code that draws it, or the GLB's names and extras. */
  authored: string;
  params: Record<string, FxParam>;
}

const p = (value: number, what: string, grows = 0): FxParam => ({ value, what, grows });

export const FX: Record<FxKind, FxType> = {
  energy: {
    name: "Energy", family: "aura",
    what: "Bright neon light running along the thing's own edges and parts, like lit-up accessory parts, with a slight glow round each line and pulses of energy travelling along them.",
    authored: "HolderFx's energy lines: the holder's own feature edges (where its faces turn sharply), each drawn as a neon tube facing you: a near-white core, its colour round it, a soft falloff. One draw.",
    params: { amount: p(1, "how bright", 0.5), width: p(1, "the line's width, times its own", 0.35), pulses: p(1.4, "pulses running along a line a second", 0.6) },
  },
  glow: {
    name: "Sun glint", family: "aura",
    what: "Sunlight glistening off the thing: a bright sheen sweeping along it now and then, breaking into fractured facets of light as it passes, star glints flashing where it catches.",
    authored: "HolderFx's glow shell (the holder's shape a hair out): a diagonal band of sunlight sweeping along it, broken into facets with a faint rainbow at their edges; the pool throws a star glint at the points it catches. For a whole model in a moment, glowOn (lib/game/fx/glowOn.ts) and the kit's outline glow.",
    params: { amount: p(1, "how bright", 0.6), sweeps: p(0.6, "sweeps a second", 0.3), glints: p(3, "star glints a sweep", 1) },
  },
  pulse: {
    name: "Pulse", family: "aura", what: "The thing's glow beating, lub-dub, and growing with strength.",
    authored: "HolderFx's glow shell lit at its rim, beating; on an effect GLB, a node's `pulse` extra (the swell, a share of its size).",
    params: { swell: p(0.08, "the swell, a share of its size"), rate: p(2.6, "rad/s"), size: p(1, "its size", 0.45) },
  },
  particles: {
    name: "Particles", family: "effect", what: "Motes of light drifting up off the thing in a slow swirl, twinkling, a few bigger soft ones among them.",
    authored: "HolderFx: motes off its surface, carried up and round its axis; on an effect GLB, the scene extras `spark`, `sparkSprite`, `sparkEvery`, `sparkSize`, `sparkRise` (GlowFx).",
    params: { rate: p(1, "how often", 1), size: p(0.06, "mote size (m)"), rise: p(0.3, "how far they drift up (m)") },
  },
  trail: {
    name: "Trail", family: "effect", what: "A faint white sweep behind the thing as it swings, a crisp brighter line along the path of its tip.",
    authored: "HolderFx: its outer half's path kept for the trail's length, drawn white and faint, the tip's edge a bright line; on an effect GLB, a node's `trail` and `trailFrom` extras (RodAura).",
    params: { length: p(0.4, "how long it lasts (s)", 0.5), width: p(0.012, "how wide (m), GLB trails") },
  },
  motion: {
    name: "Motion", family: "effect", what: "Comets of light whipping up round the thing, speeding up and easing, long tails shedding sparkle, a flash where they leave its tip.",
    authored: "HolderFx: three comets on a spiral round its axis, streaked along their path; on an effect GLB, `spin`, `bob`, `rate` extras; a cutscene's own motion in components/game/rodMotion.ts.",
    params: { spin: p(1, "turn speed, times its own", 1), bob: p(1, "reach and bob, times its own", 1) },
  },
  sparks: {
    name: "Sparks", family: "effect", what: "A one-off spray of sparks flying off the thing and fading.",
    authored: "HolderFx: a flare and a burst of streaks at its tip, sparks off its surface; sparkRecipe (lib/game/fx/glowOn.ts) into a scene's glow pool. Waiting for David's references.",
    params: { count: p(18, "sparks", 0.6), speed: p(0.9, "m/s"), life: p(0.9, "s") },
  },
  water: {
    name: "Water", family: "effect",
    what: "Water wrapped round the thing and running fast along it (the Aquatic sword's water, not its blade): deep teal-blue streaked darker and paler, foam bursting where it crashes and carried off, lots of droplets flung as it swings and drips falling off it; swung, it leaves a water trail behind it (Tanjiro's Water Breathing).",
    authored: "HolderFx: a water ribbon spiralling up its outer part, a water trail on its swing, and drops in their own pool, all drawn by lib/game/fx/water.ts (flat colours, hard edges). On an effect GLB, fx_library.py water, foam and spray parts (the Tidewarden's).",
    params: {
      flow: p(1.5, "how fast it runs (widths a second)", 0.3), foam: p(0.13, "the edge foam's width (a share of the water's)", 0.5),
      wrap: p(1, "how far it reaches: as made at 1, the grown water past it", 0.667),
      splashes: p(1, "how hard it crashes and how many drops it throws", 1),
    },
  },
  electricity: {
    name: "Electricity", family: "effect",
    what: "Electricity crawling over the thing: arcs you can watch travel along it, crackling, building as the charge builds, then a zap that jumps the length of it, and again.",
    authored: "HolderFx: arcs crawling from point to point up its surface, each piece lingering so the movement shows; the charge grows over a cycle (more arcs, faster, brighter, sparks drawn in) and lets go in one big arc base to tip with a flare.",
    params: { arcs: p(2, "arcs crawling at once", 0.8), charges: p(0.45, "charges a second (each builds, then zaps)", 0.25), arcsOut: p(0.25, "the chance of an arc out into the air, each zap", 1) },
  },
  embers: {
    name: "Embers", family: "effect", what: "Bright yellow sparks, fast and random, shooting off the thing at all angles and burning out.",
    authored: "HolderFx: sparks thrown from random points of its surface at random, each streaked along its flight, through a yellow ramp; never in pulses or rings.",
    params: { rate: p(26, "sparks a second", 0.8), speed: p(1.6, "how fast (lengths a second)", 0.2) },
  },
  flame: {
    name: "Flame", family: "effect", what: "Flame licking up the thing: fire tongues all along it rising and tearing off at the tip, embers off the top.",
    authored: "HolderFx: the library pack's looping fire tongue standing on points of its surface, through the fire ramp. Waiting for David's references.",
    params: { rate: p(1, "tongues, times 42 a second", 0.7), height: p(1, "how tall they lick", 0.35) },
  },
  petals: {
    name: "Sakura petals", family: "effect", what: "A few glowing cherry petals swirling round the thing on a wind, carried along as it moves, lifting and drifting off; never falling.",
    authored: "HolderFx: the library pack's sakura petal, each with a soft glow behind it, steered round its axis (they follow it) and lifted, then let go on the wind.",
    params: { rate: p(1, "petals, times 3 a second", 0.8) },
  },
  gather: {
    name: "Gather", family: "effect", what: "Power drawn in: streaks of light spiralling in to the thing from all round, faster as they come, flashing where they land, its glow building with it.",
    authored: "HolderFx: streaks steered in a tightening spiral onto its axis, a flash where each lands; its glow shell brightening with the gather.",
    params: { rate: p(36, "streaks a second", 1) },
  },
  sway: {
    name: "Sway", family: "effect", what: "Soft parts (leaves, cloth, hair) swinging after the thing as it moves, like a spring, and stirring a little on their own.",
    authored: "A part with a `sway` extra (how far it swings, a share of its reach) in an effect GLB: RodAura springs it after its holder's motion, bending each vertex by its reach from the holder's axis.",
    params: { swing: p(1, "how far it swings", 0.5), stiffness: p(38, "the spring (1/s²)"), damping: p(5, "how fast it settles (1/s)") },
  },
  burst: {
    name: "Burst", family: "effect", what: "A one-off flare: the glow peaks and turns its new colour, the screen takes that colour a moment, then clears.",
    authored: "A moment's beat (the kit's Awakening `burst`: impact frames, then the outline glow to its peak and a full-screen tint in the colour); on any holder, HolderFx: its shell flares, a four-point flare and streaks.",
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
