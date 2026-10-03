/**
 * The Rangers' FX recipes (classes v2; design sheet §1.7 and the LOCKED Ranger sections), merged into the registry
 * (combat.ts FX). Anime layers from the combat pack (the family rows: flame, muzzle, chain, mushroom) through each
 * kit's ramp: the Marksman's cyan, the Sniper's white-blue, the Hunter's teal, the Gunslinger's gold-on-blue. Basic
 * shots stay light (they fire up to 8 a second, 20 in Thousand Arrows); abilities read in a burst; heavy ones add
 * lines and a ring; the ults fill their budget (the warhead is the biggest effect in the game: a mushroom cloud).
 */
import { FACE, type Recipe } from "./particles";
import type { CombatSprite } from "./combatPack";
import type { FxLayer, FxRecipe, MeshLayer, ParticleLayer } from "./combat";

const P = (sprite: CombatSprite, count: [number, number], life: [number, number], size: [number, number], more: Partial<Recipe<CombatSprite>> = {}): Recipe<CombatSprite> => ({
  sprite, count, life, size, grow: 1.4, speed: [0, 0], spread: Math.PI, up: [0, 0], gravity: 0, drag: 2, wind: 0, alpha: 1, face: FACE.billboard, fadeIn: 30, ...more,
});
const glow = (recipe: Recipe<CombatSprite>, more: Partial<ParticleLayer> = {}): ParticleLayer => ({ kind: "particles", pool: "glow", recipe, ...more });
const ink = (recipe: Recipe<CombatSprite>, more: Partial<ParticleLayer> = {}): ParticleLayer => ({ kind: "particles", pool: "ink", recipe, ...more });
const ring = (from: number, to: number, life: number, more: Partial<MeshLayer> = {}): MeshLayer => ({ kind: "mesh", shape: "ring", from, to, life, ...more });
const decal = (sprite: CombatSprite, size: number, life: number, more: { byRadius?: boolean; spin?: number } = {}): FxLayer => ({ kind: "decal", sprite, size, life, ...more });

const star = (size: number, life = 0.25, lift = 0.7) => glow(P("impactStar", [1, 1], [life, life], [size, size], { grow: 1.3 }), { lift });
const sparks = (n: number, size: number, lift = 0.7) => glow(P("sparkBurst", [n, n], [0.22, 0.28], [size, size * 1.2], { grow: 1.6 }), { lift });
const flare = (size: number, life = 0.14, lift = 0.9) => glow(P("flare", [1, 1], [life, life * 1.15], [size, size * 1.15]), { lift });
const halo = (size: number, life = 0.3, lift = 0.7) => glow(P("halo", [1, 1], [life, life], [size, size], { grow: 1.2, alpha: 0.8 }), { lift });
/** A muzzle blast along the aim (a streak needs a little speed to know its way). */
const blast = (size: number, life = 0.12, lift = 0.95, n = 1, spread = 0) =>
  glow(P("muzzle", [n, n], [life, life], [size, size], { face: FACE.streak, aspect: 0.5, speed: [0.6, 0.6], spread, grow: 1.15, fadeIn: 100 }), { lift, toward: "aim" });
/** Streaks along the aim (a tracer, a rail, swift arrows) or away from it. */
const lines = (n: number, size: number, life: number, speed: [number, number], toward: "aim" | "away" = "aim", lift = 0.9, spread = 0.25) =>
  glow(P("speedLine", [n, n], [life, life * 1.2], [size, size * 1.2], { face: FACE.streak, aspect: 0.14, speed, spread, grow: 1.4 }), { lift, toward });
const puff = (n: number, size: number, life: number, more: Partial<Recipe<CombatSprite>> = {}, layer: Partial<ParticleLayer> = {}) =>
  ink(P("smoke", [n, n], [life, life * 1.25], [size, size * 1.4], { speed: [0.6, 1.6], up: [0.2, 0.6], drag: 2.4, grow: 1.8, alpha: 0.8, jitter: 0.3, ...more }), layer);
const debris = (n: number, size: number) => ink(P("debris", [n, n], [0.6, 0.8], [size, size * 1.4], { speed: [2.5, 5], up: [3, 6], gravity: 14, drag: 0.4, spin: 6, grow: 1 }));
const flames = (n: number, size: number, life: number, more: Partial<Recipe<CombatSprite>> = {}, layer: Partial<ParticleLayer> = {}) =>
  glow(P("flame", [n, n], [life, life * 1.1], [size, size * 1.3], { face: FACE.standing, fps: 12, jitter: 0.45, grow: 0.9, fadeIn: 8, ...more }), layer);
const motes = (n: number, life: number, more: Partial<Recipe<CombatSprite>> = {}, layer: Partial<ParticleLayer> = {}) =>
  glow(P("mote", [n, n], [life, life * 1.3], [0.18, 0.26], { speed: [0.3, 0.8], up: [0.8, 1.8], jitter: 0.9, grow: 0.6, ...more }), layer);
/** Gathering into the caster (an ult's wind-up): motes drawn inward. */
const gather = (n: number) => glow(P("mote", [n, n], [0.4, 0.5], [0.22, 0.3], { speed: [-4.5, -3.5], jitter: 2.6, grow: 0.4, rise: [0.1, 2] }), { lift: 0.2 });
const heavyLines = glow(P("speedLine", [10, 10], [0.2, 0.2], [1.4, 1.8], { face: FACE.streak, aspect: 0.16, speed: [6, 8], grow: 1.6 }), { lift: 0.8 });
const light = (intensity: number, distance: number, life: number): FxLayer => ({ kind: "light", intensity, distance, life });

export const RANGER_FX: Record<string, FxRecipe> = {
  // ── Marksman (cyan): the loose and its wake are tiny (8 a second); the three arrows; Back Hop; Thousand Arrows ──
  "marksman.loose": { tier: "light", layers: [flare(0.32, 0.09, 1)] },
  "marksman.wake": { tier: "light", layers: [glow(P("mote", [1, 1], [0.12, 0.14], [0.16, 0.2], { grow: 0.4 }), { lift: 0.9 })] },
  "marksman.hit": { tier: "light", layers: [sparks(1, 0.55), flare(0.38, 0.1, 0.8)] },
  "marksman.homing": { tier: "ability", layers: [decal("rune", 1.3, 0.8, { spin: 1.4 }), halo(1, 0.35, 1),
    motes(14, 0.7, { speed: [0.8, 1.4], up: [0.4, 1], spread: Math.PI })] },
  "marksman.flame": { tier: "ability", layers: [flames(6, 0.45, 0.6, { rise: [0.6, 1.2], jitter: 0.35 }), halo(1.1, 0.3, 1), sparks(1, 0.8, 1)] },
  "marksman.swift": { tier: "ability", layers: [lines(8, 1.4, 0.25, [9, 12], "aim", 1, 0.5), flare(0.9, 0.18, 1), halo(0.9, 0.25, 1)] },
  "marksman.hop": { tier: "ability", layers: [lines(6, 1.1, 0.22, [7, 9], "away", 0.6, 0.6), puff(3, 0.55, 0.45, {}, { lift: 0.1 }), ring(0.3, 1.4, 0.25, { lift: 0.08 })] },
  /** Burning ground, each pulse (every 0.5 s while it burns, a shared zone): a scorch, flames standing on it and embers. */
  "marksman.burn": { tier: "ability", layers: [decal("crack", 1, 0.6, { byRadius: true }), flames(4, 0.55, 0.55, {}, { lift: 0 }),
    motes(3, 0.6, { up: [1.2, 2.2], speed: [0.1, 0.3] }, { lift: 0.2 })] },
  "marksman.surge": { tier: "light", layers: [glow(P("speedLine", [1, 1], [0.08, 0.08], [0.7, 0.8], { face: FACE.streak, aspect: 0.12, speed: [0.5, 0.5], spread: 0 }), { lift: 0.9 })] },
  "marksman.ultCharge": { tier: "ult", layers: [decal("rune", 3.4, 1, { spin: 0.8 }), gather(28), glow(P("swirl", [1, 1], [0.45, 0.45], [1.6, 1.6], { grow: 0.5 }), { lift: 1.1 }),
    glow(P("speedLine", [12, 14], [0.35, 0.4], [1.4, 1.8], { face: FACE.streak, aspect: 0.12, speed: [0.5, 1], up: [14, 18], spread: 0.6 }), { lift: 1.2 }),
    { kind: "mesh", shape: "pillar", from: 0.5, to: 0.2, height: 4, life: 0.45 }, light(24, 9, 0.5)] },
  /** The volley falling on the aim: a rain of streaks, the star, rings, dust and the crater. */
  "marksman.volley": { tier: "ult", layers: [glow(P("speedLine", [36, 40], [0.32, 0.4], [1.6, 2.2], { face: FACE.streak, aspect: 0.1, speed: [0.3, 0.6], up: [-16, -12], jitter: 2.6 }), { lift: 5, byRadius: true }),
    star(4.2, 0.35, 0.5), sparks(4, 2.4), heavyLines, ring(0.6, 4.6, 0.5, { lift: 0.15, byRadius: true }), ring(0.4, 3, 0.4, { lift: 0.9 }),
    ink(P("smoke", [8, 10], [1, 1.4], [1.4, 2], { speed: [2, 3.5], up: [0.3, 0.9], drag: 2.2, grow: 2, alpha: 0.75, jitter: 1.4 }), { byRadius: true }), debris(12, 0.45), light(36, 12, 0.5)] },
  "marksman.ultDecal": { tier: "ult", layers: [decal("crack", 1.8, 4, { byRadius: true }), decal("rune", 1.4, 2, { byRadius: true, spin: 0.5 })] },

  // ── Sniper (white-blue): the muzzle, the tracer and the hit; Scope; the rounds; Smoke Roll; the mine; Final Shot ──
  "sniper.muzzle": { tier: "light", layers: [blast(1.3, 0.12, 1.05), puff(2, 0.35, 0.5, { speed: [0.3, 0.8] }, { lift: 1, toward: "aim" }), flare(0.5, 0.08, 1.05)] },
  "sniper.tracer": { tier: "light", layers: [glow(P("speedLine", [1, 1], [0.07, 0.07], [1.6, 1.6], { face: FACE.streak, aspect: 0.06, speed: [0.5, 0.5], spread: 0 }), { lift: 0.9 })] },
  "sniper.hit": { tier: "light", layers: [star(0.85, 0.18), sparks(1, 0.7)] },
  "sniper.scope": { tier: "ability", layers: [glow(P("rune", [1, 1], [0.6, 0.6], [0.9, 0.9], { grow: 0.8, alpha: 0.85 }), { lift: 1.25 }), halo(0.8, 0.3, 1.2)] },
  "sniper.muzzleBig": { tier: "heavy", layers: [blast(2.2, 0.14, 1.05), ring(0.3, 1.6, 0.25, { lift: 1 }), puff(4, 0.5, 0.6, { speed: [0.6, 1.4] }, { lift: 1, toward: "aim" }),
    lines(4, 1.2, 0.18, [6, 8], "aim", 1, 0.2), flare(0.8, 0.1, 1.05)] },
  "sniper.rail": { tier: "heavy", layers: [glow(P("speedLine", [2, 2], [0.1, 0.12], [2, 2.4], { face: FACE.streak, aspect: 0.08, speed: [0.5, 0.5], spread: 0 }), { lift: 0.9 }),
    glow(P("halo", [1, 1], [0.08, 0.08], [0.5, 0.5]), { lift: 0.9 })] },
  "sniper.pierceHit": { tier: "heavy", layers: [star(1.4, 0.22), sparks(2, 1), lines(6, 1.2, 0.18, [6, 8], "aim", 0.8, 0.35)] },
  "sniper.cluster": { tier: "heavy", layers: [star(1.8, 0.28, 0.5), sparks(3, 1.3), ring(0.4, 2.2, 0.35, { lift: 0.2 }), puff(5, 0.9, 0.9, {}, { lift: 0.3 }), debris(6, 0.35)] },
  "sniper.bomblet": { tier: "ability", layers: [star(1, 0.2, 0.4), sparks(1, 0.9, 0.4), puff(2, 0.6, 0.7, {}, { lift: 0.2 }), ring(0.2, 1.5, 0.25, { lift: 0.1, byRadius: true })] },
  "sniper.smoke": { tier: "heavy", layers: [puff(9, 1, 1.2, { speed: [1, 2.4], up: [0.1, 0.4], jitter: 0.8 }, { lift: 0.4 }), ring(0.4, 2.6, 0.35, { lift: 0.1 })] },
  "sniper.smokeCloud": { tier: "heavy", layers: [puff(5, 1.2, 1, { speed: [0.2, 0.6], up: [0.05, 0.25], drag: 3, jitter: 1.6 }, { lift: 0.5, byRadius: true })] },
  "sniper.mineSet": { tier: "ability", layers: [flare(0.6, 0.15, 0.6), sparks(1, 0.6, 0.6)] },
  "sniper.mineZone": { tier: "ability", layers: [decal("rune", 1.5, 1.5, { spin: 2 }), halo(0.7, 0.4, 0.2)] },
  "trap.sniper-mine": { tier: "heavy", layers: [star(2, 0.28, 0.4), sparks(3, 1.4, 0.4), ring(0.4, 2.2, 0.35, { lift: 0.15, byRadius: true }), puff(5, 1, 0.9, {}, { lift: 0.2 }),
    debris(8, 0.35), decal("crack", 0.8, 3, { byRadius: true })] },
  /** Final Shot: the scope's glyph locks under you, the field holds its breath, then one rail through it all. */
  "sniper.ultCharge": { tier: "ult", layers: [decal("rune", 3.2, 1.2, { spin: 0.4 }), gather(26), glow(P("rune", [1, 1], [0.75, 0.75], [1.4, 1.4], { grow: 0.7 }), { lift: 1.25 }),
    lines(12, 1.6, 0.4, [-10, -8], "aim", 1, Math.PI), halo(2, 0.6, 1.2), light(20, 8, 0.6)] },
  "sniper.ultRail": { tier: "ult", layers: [glow(P("speedLine", [3, 3], [0.22, 0.26], [3, 3.6], { face: FACE.streak, aspect: 0.12, speed: [0.5, 0.5], spread: 0 }), { lift: 0.9 }),
    glow(P("halo", [1, 1], [0.2, 0.2], [1.1, 1.1], { grow: 0.6 }), { lift: 0.9 }), sparks(1, 0.8, 0.9)] },
  "sniper.ultHit": { tier: "ult", layers: [star(2.6, 0.3), sparks(3, 1.8), heavyLines, ring(0.4, 2.8, 0.35, { lift: 0.6 }), halo(2.2, 0.4, 0.8), light(28, 8, 0.35)] },

  // ── Hunter (teal): the harpoon bolt, Camouflage, the traps, the mark, the harpoon's chain, the Great Hunt ──
  "hunter.loose": { tier: "light", layers: [blast(0.8, 0.1, 1), flare(0.35, 0.08, 1)] },
  "hunter.wake": { tier: "light", layers: [glow(P("speedLine", [1, 1], [0.08, 0.08], [0.8, 0.9], { face: FACE.streak, aspect: 0.1, speed: [0.5, 0.5], spread: 0 }), { lift: 0.9 })] },
  "hunter.hit": { tier: "light", layers: [star(0.8, 0.18), sparks(1, 0.6), ink(P("debris", [2, 3], [0.4, 0.5], [0.2, 0.28], { speed: [1.5, 3], up: [1.5, 3], gravity: 12, drag: 0.4, spin: 6, grow: 1 }))] },
  "hunter.camo": { tier: "ability", layers: [puff(5, 0.7, 0.9, { speed: [0.3, 0.9] }, { lift: 0.3 }), motes(12, 0.9, { up: [0.2, 0.8], speed: [0.6, 1.2] }, { lift: 0.4 }),
    decal("rune", 1.6, 0.9, { spin: -1 })] },
  "hunter.trapSet": { tier: "ability", layers: [flare(0.55, 0.14, 0.8), sparks(1, 0.5, 0.8)] },
  "hunter.trapZone": { tier: "ability", layers: [decal("rune", 1.5, 1.4, { spin: 1.6 }), ring(0.2, 1.2, 0.3, { lift: 0.05 }), motes(6, 0.6, { up: [0.6, 1.2] }, { lift: 0.1 })] },
  "trap.snare-trap": { tier: "ability", layers: [glow(P("chain", [4, 4], [0.45, 0.5], [1.1, 1.2], { face: FACE.ground, spin: 2, grow: 0.7 }), { lift: 0.05 }), ring(1.2, 0.3, 0.3, { lift: 0.08 }),
    flare(0.8, 0.15, 0.4), decal("rune", 1.2, 2)] },
  "trap.spike-trap": { tier: "ability", layers: [{ kind: "mesh", shape: "spike", from: 0.1, to: 0.32, height: 1.2, life: 0.45 }, { kind: "mesh", shape: "spike", from: 0.6, to: 0.9, height: 0.7, life: 0.4, byRadius: true },
    star(1.3, 0.22, 0.4), debris(6, 0.3), decal("crack", 0.9, 3, { byRadius: true })] },
  "hunter.markWake": { tier: "light", layers: [glow(P("mote", [1, 1], [0.14, 0.16], [0.2, 0.24], { grow: 0.4 }), { lift: 0.9 })] },
  "hunter.mark": { tier: "ability", layers: [glow(P("rune", [1, 1], [0.9, 0.9], [1, 1], { spin: 2, grow: 0.9 }), { lift: 1.9 }), flare(0.9, 0.2, 1.2), sparks(1, 0.7, 1)] },
  "hunter.chain": { tier: "ability", layers: [glow(P("chain", [1, 1], [0.1, 0.1], [1.1, 1.1], { face: FACE.streak, aspect: 0.2, speed: [0.5, 0.5], spread: 0, grow: 1 }), { lift: 0.9 })] },
  "hunter.harpoonHit": { tier: "ability", layers: [star(1.2, 0.22), sparks(2, 0.9), glow(P("chain", [2, 2], [0.3, 0.35], [1, 1.1], { face: FACE.streak, aspect: 0.2, speed: [3, 4], spread: 0.3, grow: 0.8 }), { lift: 0.9, toward: "away" })] },
  "hunter.zip": { tier: "ability", layers: [lines(6, 1.4, 0.25, [10, 13], "aim", 0.9, 0.3), glow(P("chain", [2, 2], [0.25, 0.3], [1.3, 1.4], { face: FACE.streak, aspect: 0.2, speed: [8, 9], spread: 0.05 }), { lift: 0.9, toward: "aim" })] },
  /** The Great Hunt: a horn call (a ring over the field, motes rising), every trap's chain to the next, the hounds loosed. */
  "hunter.ultCharge": { tier: "ult", layers: [decal("rune", 3.6, 1.2, { spin: -0.6 }), gather(24), ring(0.5, 7, 0.6, { lift: 0.3 }), ring(0.3, 4, 0.5, { lift: 1.4 }),
    glow(P("swirl", [1, 1], [0.5, 0.5], [1.8, 1.8], { grow: 0.6 }), { lift: 1 }), light(22, 10, 0.6)] },
  "hunter.ultChain": { tier: "ult", layers: [{ kind: "mesh", shape: "beam", from: 0.5, to: 2.8, life: 0.55, lift: 0.4, byRadius: true },
    glow(P("chain", [6, 6], [0.5, 0.6], [1, 1.2], { face: FACE.streak, aspect: 0.2, speed: [5, 9], spread: 0.04, grow: 1 }), { lift: 0.4, toward: "aim" }), sparks(2, 1, 0.4)] },
  "hunter.ultHit": { tier: "ult", layers: [star(2.4, 0.3, 0.4), sparks(3, 1.6, 0.4), heavyLines, ring(0.3, 2.6, 0.35, { lift: 0.15 }),
    { kind: "mesh", shape: "spike", from: 0.2, to: 0.5, height: 1.6, life: 0.5 }, debris(8, 0.35)] },
  "hunter.ultDecal": { tier: "ult", layers: [decal("rune", 3, 4, { spin: 0.3 }), decal("crack", 2.2, 4)] },

  // ── Gunslinger (gold on blue): the six-gun, the rounds, the keys, the perfect reload, Russian Roulette ──
  "gunslinger.muzzle": { tier: "light", layers: [blast(0.9, 0.09, 0.95), flare(0.4, 0.07, 0.95), puff(1, 0.3, 0.4, { speed: [0.3, 0.6] }, { lift: 0.95, toward: "aim" })] },
  "gunslinger.tracer": { tier: "light", layers: [glow(P("speedLine", [1, 1], [0.06, 0.06], [1, 1.1], { face: FACE.streak, aspect: 0.06, speed: [0.5, 0.5], spread: 0 }), { lift: 0.9 })] },
  "gunslinger.hit": { tier: "light", layers: [star(0.65, 0.15), sparks(1, 0.5)] },
  "gunslinger.boom": { tier: "ability", layers: [star(1.4, 0.24, 0.5), flames(3, 0.5, 0.6, {}, { lift: 0 }), ring(0.3, 1.8, 0.3, { lift: 0.15, byRadius: true }), puff(3, 0.7, 0.8, {}, { lift: 0.3 }), debris(4, 0.3)] },
  "gunslinger.gold": { tier: "heavy", layers: [star(1.8, 0.26), sparks(2, 1.2), heavyLines, ring(0.3, 2, 0.3, { lift: 0.6 }), flare(1.2, 0.2, 0.8)] },
  "gunslinger.goldTrail": { tier: "light", layers: [glow(P("flare", [1, 1], [0.1, 0.12], [0.35, 0.4], { grow: 0.6 }), { lift: 0.9 })] },
  /** The warhead: a white flash, a fireball rising into a mushroom cloud, two shock rings over the field, a dome, debris and dust. */
  "gunslinger.nuke": { tier: "ult", layers: [glow(P("mushroom", [1, 1], [2.6, 2.6], [7, 8.5], { face: FACE.standing, grow: 1.25, fadeIn: 6 }), { lift: 0 }),
    star(7, 0.4, 1), halo(8, 0.6, 1.4), ring(0.6, 9, 0.8, { lift: 0.15, byRadius: true }), ring(0.4, 6, 0.6, { lift: 2 }),
    { kind: "mesh", shape: "dome", from: 1, to: 5.5, height: 3, life: 0.9, byRadius: true }, { kind: "mesh", shape: "pillar", from: 1.2, to: 2.2, height: 9, life: 0.7 },
    debris(16, 0.6), ink(P("smoke", [14, 16], [1.6, 2.2], [2, 3], { speed: [3, 6], up: [0.4, 1.4], drag: 1.8, grow: 2.2, alpha: 0.8, jitter: 2 }), { byRadius: true }),
    glow(P("speedLine", [16, 18], [0.4, 0.45], [2.6, 3.2], { face: FACE.streak, aspect: 0.14, speed: [12, 16], grow: 1.6 }), { lift: 1 }),
    light(60, 18, 0.7), light(30, 10, 1.2)] },
  "gunslinger.warheadTrail": { tier: "light", layers: [flames(1, 0.4, 0.16, { face: FACE.billboard, fps: 0 }, { lift: 0.9 }), glow(P("halo", [1, 1], [0.08, 0.08], [0.5, 0.5]), { lift: 0.9 })] },
  "gunslinger.fan": { tier: "ability", layers: [blast(1.1, 0.12, 0.95, 3, 0.5), puff(3, 0.4, 0.5, { speed: [0.4, 1] }, { lift: 0.95, toward: "aim" }), sparks(1, 0.7, 0.95)] },
  "gunslinger.trickTrail": { tier: "light", layers: [glow(P("speedLine", [1, 1], [0.1, 0.1], [0.9, 1], { face: FACE.streak, aspect: 0.08, speed: [0.5, 0.5], spread: 0 }), { lift: 0.9 }),
    glow(P("flare", [1, 1], [0.08, 0.08], [0.3, 0.3]), { lift: 0.9 })] },
  "gunslinger.ricochet": { tier: "ability", layers: [flare(0.9, 0.14, 0.9), sparks(2, 0.8, 0.9), lines(3, 0.9, 0.15, [5, 7], "aim", 0.9, 0.4)] },
  "gunslinger.load": { tier: "ability", layers: [flare(0.6, 0.16, 1), sparks(1, 0.6, 1), halo(0.7, 0.3, 1)] },
  "gunslinger.roll": { tier: "ability", layers: [puff(4, 0.55, 0.5, {}, { lift: 0.1 }), lines(5, 1, 0.2, [7, 9], "away", 0.6, 0.5)] },
  "gunslinger.muzzleBig": { tier: "heavy", layers: [blast(1.6, 0.12, 0.95), ring(0.2, 1.3, 0.22, { lift: 0.95 }), puff(3, 0.45, 0.55, { speed: [0.5, 1.2] }, { lift: 0.95, toward: "aim" }), flare(0.7, 0.09, 0.95)] },
  "gunslinger.quickdraw": { tier: "heavy", layers: [star(1.5, 0.24), sparks(2, 1), heavyLines, ring(0.3, 1.6, 0.28, { lift: 0.6 })] },
  "gunslinger.perfect": { tier: "ability", layers: [flare(1.1, 0.2, 1.1), sparks(2, 0.9, 1.1), halo(1, 0.35, 1.1)] },
  /** The spin: the cylinder whirs (a swirl at the gun), a rune under you, motes drawn in, a gold glint. */
  "gunslinger.spin": { tier: "ult", layers: [decal("rune", 3, 1.2, { spin: 3 }), gather(22), glow(P("swirl", [1, 1], [0.5, 0.5], [1.4, 1.4], { grow: 0.6 }), { lift: 1 }),
    flare(1.4, 0.3, 1.1), light(18, 7, 0.5)] },
};
