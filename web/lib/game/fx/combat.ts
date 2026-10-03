/**
 * The combat FX registry (design sheet §1.7): data-driven recipes, keyed by the names abilities give in `vfx` (and the
 * hit tiers, `hit.<tier>`), each a few layers: painted flipbooks from the combat pack (glow ones added, smoke and ink
 * laid over), ground decals, meshes in the shared FxMaterial (rings, pillars, domes, beams, spikes) and at most two
 * pooled point lights for an ult. Every effect comes from an FX event (caster, key, phase, place, aim, seed, tier,
 * ramp) and is seeded from it, so every client draws the same. Colour comes from the event's 3-stop ramp: the pack
 * stores heat, the shaders map heat through the ramp (edge → mid → core). Family waves add their recipes here; the
 * budget test keeps every recipe inside its tier's budget.
 */
import { FACE, type Recipe } from "./particles";
import type { CombatSprite } from "./combatPack";
import type { ImpactTier } from "@/lib/game/combat/runtime";
import { ARCANE_FX } from "./arcaneFx";

export type Ramp = readonly [core: string, mid: string, edge: string];
/** Flipbooks: `glow` adds (sparks, stars, halos, lines), `ink` lays over (smoke, debris, ink). `at` where it starts: the event's spot or the caster's hands. */
export interface ParticleLayer { kind: "particles"; pool: "glow" | "ink"; recipe: Recipe<CombatSprite>; lift?: number; toward?: "aim" | "away"; byRadius?: boolean }
/** A flat quad on the ground (scorch, frost, rune circle, crack, root mat): ≤ 4 s, at most 16 alive, under enemy markers. */
export interface DecalLayer { kind: "decal"; sprite: CombatSprite; size: number; life: number; byRadius?: boolean; spin?: number }
/** A mesh in the FxMaterial: its size grows from `from` to `to` (radius, u) over `life`, `height` for pillars and domes. */
export interface MeshLayer { kind: "mesh"; shape: "ring" | "pillar" | "dome" | "beam" | "spike"; from: number; to: number; height?: number; life: number; lift?: number; byRadius?: boolean }
export interface LightLayer { kind: "light"; intensity: number; distance: number; life: number }
export type FxLayer = ParticleLayer | DecalLayer | MeshLayer | LightLayer;
export interface FxRecipe { tier: ImpactTier; layers: FxLayer[] }

/** §1.7 budgets per effect (particles at most; meshes; decals; lights; seconds alive, decals apart). */
export const FX_BUDGET: Record<ImpactTier, { particles: number; meshes: number; decals: number; lights: number; life: number; decalLife: number }> = {
  light: { particles: 60, meshes: 3, decals: 1, lights: 0, life: 1.2, decalLife: 4 },
  ability: { particles: 60, meshes: 3, decals: 1, lights: 0, life: 1.2, decalLife: 4 },
  heavy: { particles: 120, meshes: 5, decals: 1, lights: 0, life: 1.5, decalLife: 4 },
  ult: { particles: 300, meshes: 8, decals: 2, lights: 2, life: 3, decalLife: 4 },
};
/** Whole scene: one pool of 1,024 (768 glow + 256 ink, one draw each), 16 decals, 24 meshes, 2 lights. */
export const FX_POOLS = { glow: 768, ink: 256, decals: 16, meshes: 24, lights: 2 } as const;

const P = (sprite: CombatSprite, count: [number, number], life: [number, number], size: [number, number], more: Partial<Recipe<CombatSprite>> = {}): Recipe<CombatSprite> => ({
  sprite, count, life, size, grow: 1.4, speed: [0, 0], spread: Math.PI, up: [0, 0], gravity: 0, drag: 2, wind: 0, alpha: 1, face: FACE.billboard, fadeIn: 30, ...more,
});
const glow = (recipe: Recipe<CombatSprite>, more: Partial<ParticleLayer> = {}): ParticleLayer => ({ kind: "particles", pool: "glow", recipe, ...more });
const ink = (recipe: Recipe<CombatSprite>, more: Partial<ParticleLayer> = {}): ParticleLayer => ({ kind: "particles", pool: "ink", recipe, ...more });
const ring = (from: number, to: number, life: number, more: Partial<MeshLayer> = {}): MeshLayer => ({ kind: "mesh", shape: "ring", from, to, life, ...more });

/** Speed lines round a heavy hit (world space, 200 ms), and its shock ring. */
const heavyLines = glow(P("speedLine", [10, 10], [0.2, 0.2], [1.4, 1.8], { face: FACE.streak, aspect: 0.16, speed: [6, 8], grow: 1.6 }), { lift: 0.8 });
const sparks = (n: number, size: number) => glow(P("sparkBurst", [n, n], [0.22, 0.28], [size, size * 1.2], { grow: 1.6 }), { lift: 0.7 });
const star = (size: number, life = 0.25) => glow(P("impactStar", [1, 1], [life, life], [size, size], { grow: 1.3 }), { lift: 0.7 });
const halo = (size: number, life = 0.3, lift = 0.7) => glow(P("halo", [1, 1], [life, life], [size, size], { grow: 1.2, alpha: 0.8 }), { lift });

/** Dust kicked off the ground (ink pool: laid over). */
const dust = (n: number, size: number, more: Partial<Recipe<CombatSprite>> = {}) => ink(P("smoke", [n, n], [0.5, 0.7], [size, size * 1.4], { speed: [1, 2.4], up: [0.2, 0.6], drag: 3, grow: 1.8, alpha: 0.7, jitter: 0.4, ...more }));
const lines = (n: number, size: number, life = 0.25, more: Partial<ParticleLayer> = {}) => glow(P("speedLine", [n, n], [life, life], [size, size * 1.3], { face: FACE.streak, aspect: 0.14, speed: [7, 10], grow: 1.5 }), { lift: 0.8, ...more });
const shards = (n: number, size: number, more: Partial<Recipe<CombatSprite>> = {}) => glow(P("aegisShard", [n, n], [0.35, 0.5], [size, size * 1.3], { speed: [1.5, 3.2], up: [0.6, 1.6], gravity: 4, drag: 1.5, spin: 4, grow: 0.8, ...more }), { lift: 0.8 });
const petals = (n: number, size: number, more: Partial<Recipe<CombatSprite>> = {}) => glow(P("lotusPetal", [n, n], [0.6, 0.9], [size, size * 1.3], { speed: [1.2, 2.6], up: [0.4, 1.2], gravity: 1.2, drag: 2, spin: 3, grow: 0.9, alpha: 0.9, ...more }), { lift: 0.9 });
const brush = (size: number, life = 0.3, lift = 0.8) => ink(P("inkSlash", [1, 1], [life, life], [size, size], { grow: 1.1, face: FACE.billboard }), { lift });
const splat = (n: number, size: number) => ink(P("ink", [n, n], [0.45, 0.6], [size, size * 1.3], { speed: [0.6, 1.6], up: [0.2, 0.6], drag: 3, grow: 1.3, alpha: 0.95, jitter: 0.3 }), { lift: 0.7 });
const debrisOf = (n: number, size: number) => ink(P("debris", [n, n], [0.7, 0.9], [size, size * 1.4], { speed: [2.5, 5], up: [3, 6], gravity: 14, drag: 0.4, spin: 6, grow: 1 }));
const decal = (sprite: CombatSprite, size: number, life: number, more: Partial<DecalLayer> = {}): DecalLayer => ({ kind: "decal", sprite, size, life, ...more });

/**
 * The Vanguard family's effects (classes v2 wave: specs/classes/design-sheet.md, the LOCKED kits): the Guardian's gold
 * shield shards, the Juggernaut's dust, debris and cracked ground, the Martial Artist's flame-orange strike flares, and
 * the Assassin's black ink with red (its ramp's mid band), brush slashes and lotus petals. All in each kit's ramp.
 */
const VANGUARD_FX: Record<string, FxRecipe> = {
  // ── Guardian ──
  "guardian.block": { tier: "ability", layers: [shards(3, 0.35, { speed: [0.5, 1.2], spread: 0.6, up: [0.2, 0.6], gravity: 0 }), halo(1.4, 0.3, 0.9)] },
  "guardian.parry": { tier: "heavy", layers: [star(2.1, 0.28), glow(P("slash", [1, 1], [0.26, 0.26], [2.6, 2.6], { grow: 1.15 }), { lift: 0.9 }), shards(10, 0.4), sparks(3, 1.5), ring(0.3, 2.4, 0.3, { lift: 0.5 }), heavyLines] },
  "guardian.challenge": { tier: "ability", layers: [ring(0.5, 7, 0.5, { lift: 0.25 }), decal("rune", 2.6, 1, { spin: 0.5 }), shards(8, 0.3, { speed: [0.3, 0.8], up: [1.2, 2], gravity: 0 })] },
  "guardian.rush": { tier: "ability", layers: [lines(8, 1.2, 0.3, { toward: "aim" }), dust(4, 0.7, { speed: [0.8, 1.8] }), halo(1.2, 0.25, 0.8)] },
  "guardian.rushHit": { tier: "ability", layers: [star(1.6), sparks(2, 1.2), shards(4, 0.32), debrisOf(4, 0.3)] },
  "guardian.domeCast": { tier: "ability", layers: [decal("rune", 3.2, 1.1, { spin: 0.4 }), shards(10, 0.3, { speed: [0.4, 1], up: [2, 3.2], gravity: 1 }), halo(2, 0.4, 0.6)] },
  /** Re-thrown each second while the dome stands (an effect lives at most 1.2 s): the shell and a few shards round its rim. */
  "guardian.dome": { tier: "ability", layers: [{ kind: "mesh", shape: "dome", from: 2.55, to: 2.6, height: 1.5, life: 1.05 },
    glow(P("aegisShard", [4, 5], [0.8, 1], [0.22, 0.3], { speed: [0.1, 0.3], up: [0.2, 0.5], jitter: 2.4, spin: 1.5, grow: 0.8, alpha: 0.8 }), { lift: 0.6 })] },
  "guardian.throwCast": { tier: "ability", layers: [sparks(1, 0.9), halo(0.9, 0.2, 1)] },
  "guardian.shieldSpin": { tier: "ability", layers: [glow(P("aegisShard", [1, 1], [0.16, 0.2], [0.42, 0.5], { spin: 9, grow: 0.6 }), { lift: 0.9 })] },
  "guardian.shieldHit": { tier: "ability", layers: [star(1.2), shards(4, 0.3), sparks(1, 1)] },
  "guardian.ultCast": { tier: "ult", layers: [decal("rune", 3.6, 1.2, { spin: 0.3 }), glow(P("aegisShard", [20, 24], [0.45, 0.55], [0.26, 0.34], { speed: [-4.2, -3.2], jitter: 2.6, spin: 5, grow: 0.5, rise: [0.1, 2] }), { lift: 0.2 }),
    { kind: "mesh", shape: "pillar", from: 0.5, to: 0.35, height: 3, life: 0.5 }, halo(2.2, 0.5, 0.9)] },
  "guardian.ultImpact": { tier: "ult", layers: [star(5, 0.4), sparks(4, 3), halo(5, 0.5, 0.6), heavyLines, lines(14, 2.8, 0.4, { lift: 1 }),
    ring(0.6, 6.5, 0.6, { lift: 0.2, byRadius: true }), ring(0.4, 4, 0.45, { lift: 1.2 }), { kind: "mesh", shape: "dome", from: 1, to: 5.2, height: 2, life: 0.75, byRadius: true },
    shards(24, 0.45, { speed: [3, 7], up: [2, 5], gravity: 9 }), debrisOf(12, 0.5), dust(8, 1.8, { speed: [2, 4] }), { kind: "light", intensity: 40, distance: 12, life: 0.5 }] },
  "guardian.ultDecal": { tier: "ult", layers: [decal("crack", 2.2, 4, { byRadius: true }), decal("rune", 1.6, 2.4, { byRadius: true, spin: 0.4 })] },
  // ── Juggernaut ──
  "juggernaut.charge": { tier: "ability", layers: [lines(10, 1.4, 0.3, { toward: "aim" }), dust(6, 0.9, { speed: [1, 2.6] }), halo(1.3, 0.25, 0.8)] },
  "juggernaut.chargeHit": { tier: "ability", layers: [star(1.8), sparks(2, 1.3), debrisOf(6, 0.36)] },
  "juggernaut.slamCast": { tier: "ability", layers: [dust(3, 0.8)] },
  "juggernaut.slam": { tier: "heavy", layers: [star(2.6, 0.3), sparks(3, 1.6), halo(2.6, 0.3, 0.5), ring(0.5, 3.2, 0.45, { lift: 0.15, byRadius: true }), debrisOf(10, 0.45), dust(6, 1.3, { speed: [1.5, 3.4] }), heavyLines] },
  "juggernaut.crack": { tier: "heavy", layers: [decal("crack", 2.2, 3, { byRadius: true })] },
  "juggernaut.warcry": { tier: "ability", layers: [ring(0.6, 8, 0.5, { lift: 1.1 }), ring(0.4, 5, 0.4, { lift: 0.4 }), lines(12, 1.6, 0.35, { lift: 1.3 }), halo(1.8, 0.4, 1.4)] },
  "juggernaut.quake": { tier: "heavy", layers: [star(2.4, 0.3), ring(0.5, 2.8, 0.4, { lift: 0.15, byRadius: true }), debrisOf(10, 0.42), dust(6, 1.2, { speed: [1.8, 3.6] }), heavyLines] },
  "juggernaut.ultCast": { tier: "ult", layers: [glow(P("swirl", [1, 1], [0.6, 0.6], [2.6, 2.6], { grow: 0.6 }), { lift: 1.2 }), ink(P("debris", [10, 12], [0.6, 0.7], [0.3, 0.45], { speed: [0.2, 0.6], up: [2.5, 4], gravity: 3, spin: 3, jitter: 2 })),
    ring(0.4, 4.5, 0.5, { lift: 0.2 }), { kind: "mesh", shape: "pillar", from: 0.8, to: 1.6, height: 4, life: 0.5 }, { kind: "light", intensity: 26, distance: 10, life: 0.5 }] },
  "juggernaut.ultImpact": { tier: "ult", layers: [star(5.5, 0.4), sparks(4, 3), halo(5, 0.5, 0.6), heavyLines, lines(14, 3, 0.4, { lift: 1 }), ring(0.6, 7, 0.6, { lift: 0.2 }),
    { kind: "mesh", shape: "beam", from: 0.5, to: 9, life: 0.7 }, debrisOf(16, 0.6), dust(10, 2.2, { speed: [2.5, 5] }), { kind: "light", intensity: 40, distance: 13, life: 0.5 }] },
  /** Titan's swings (and its ult areas' zone): a shockwave out in front, chips and dust. */
  "juggernaut.ultShock": { tier: "ability", layers: [ring(0.6, 4, 0.4, { lift: 0.3 }), debrisOf(5, 0.4), dust(4, 1.2, { speed: [2, 3.5] }), decal("crack", 2.4, 2)] },
  // ── Martial Artist ──
  "monk.teep": { tier: "ability", layers: [star(1.2, 0.2), lines(6, 1, 0.22, { toward: "aim" }), dust(2, 0.6)] },
  "monk.elbow": { tier: "heavy", layers: [glow(P("slash", [1, 1], [0.24, 0.24], [2.2, 2.2], { grow: 1.1 }), { lift: 1.1 }), star(1.8, 0.25), sparks(3, 1.4), heavyLines, ring(0.2, 1.6, 0.25, { lift: 1 })] },
  "monk.cut": { tier: "light", layers: [glow(P("slash", [1, 1], [0.18, 0.18], [0.8, 0.8], { grow: 1.1 }), { lift: 1 }), glow(P("flare", [1, 1], [0.14, 0.16], [0.4, 0.5]), { lift: 1 })] },
  "monk.knee": { tier: "ability", layers: [star(1.4, 0.22), sparks(2, 1.1), ring(0.2, 1.4, 0.22, { lift: 0.9 })] },
  "monk.roundhouse": { tier: "ability", layers: [glow(P("slash", [2, 2], [0.24, 0.26], [2.6, 3], { grow: 1.15 }), { lift: 1 }), sparks(2, 1.2), ring(0.4, 2.3, 0.3, { lift: 0.8 })] },
  "monk.leap": { tier: "ability", layers: [dust(4, 0.8), lines(6, 1.1, 0.25, { toward: "aim" })] },
  "monk.ultCast": { tier: "ult", layers: [glow(P("swirl", [1, 1], [0.45, 0.45], [1.8, 1.8], { grow: 0.5 }), { lift: 1 }), glow(P("mote", [24, 28], [0.35, 0.45], [0.2, 0.28], { speed: [-4, -3], jitter: 2.2, grow: 0.4, rise: [0.2, 1.8] }), { lift: 0.2 }),
    decal("rune", 2.6, 1, { spin: 0.6 }), { kind: "light", intensity: 20, distance: 8, life: 0.45 }] },
  /** Each of the eight strikes between the first and the last: its own small impact frame (heavy tier). */
  "monk.ultHit": { tier: "heavy", layers: [star(1.9, 0.22), sparks(2, 1.4), heavyLines, ring(0.2, 1.8, 0.22, { lift: 1 })] },
  "monk.ultImpact": { tier: "ult", layers: [star(4.5, 0.4), sparks(4, 2.6), halo(4, 0.45, 0.9), heavyLines, lines(14, 2.8, 0.4, { lift: 1 }),
    glow(P("slash", [2, 2], [0.3, 0.32], [4, 4.6], { grow: 1.15 }), { lift: 1.1 }), ring(0.5, 5.5, 0.55, { lift: 0.5 }), dust(8, 1.8, { speed: [2.5, 4.5] }), { kind: "light", intensity: 36, distance: 11, life: 0.45 }] },
  "monk.ultShock": { tier: "ult", layers: [ring(0.4, 4, 0.5, { lift: 0.15 }), decal("crack", 2, 3, { byRadius: true })] },
  // ── Assassin: black ink and red ──
  "assassin.kunaiHit": { tier: "ability", layers: [splat(1, 0.5), glow(P("flare", [1, 1], [0.16, 0.18], [0.6, 0.7]), { lift: 0.8 })] },
  "assassin.inkPuff": { tier: "ability", layers: [splat(3, 0.8), ink(P("smoke", [4, 5], [0.45, 0.6], [0.7, 1], { speed: [0.8, 1.8], up: [0.3, 0.8], drag: 3, grow: 1.6, alpha: 0.9, jitter: 0.4 }), { lift: 0.6 }), petals(4, 0.26)] },
  "assassin.inkArrive": { tier: "ability", layers: [brush(1.6, 0.28, 0.9), splat(2, 0.7), petals(5, 0.26)] },
  "assassin.kunaiTrail": { tier: "ability", layers: [ink(P("ink", [1, 1], [0.14, 0.18], [0.16, 0.22], { grow: 0.6 }), { lift: 0.9 }), glow(P("speedLine", [1, 1], [0.1, 0.12], [0.5, 0.6], { face: FACE.streak, aspect: 0.12 }), { lift: 0.9 })] },
  "assassin.lotusCast": { tier: "ability", layers: [petals(12, 0.3, { speed: [2.4, 4], up: [0.2, 0.6] }), splat(3, 0.9), ring(0.4, 2.8, 0.35, { lift: 0.8 })] },
  "assassin.inkCut": { tier: "ability", layers: [brush(1.5, 0.26), glow(P("flare", [1, 1], [0.14, 0.16], [0.6, 0.7]), { lift: 0.9 }), petals(2, 0.22)] },
  "assassin.smokeBurst": { tier: "ability", layers: [ink(P("smoke", [9, 11], [0.8, 1.1], [1.2, 1.8], { speed: [1.5, 3], up: [0.3, 0.9], drag: 2.6, grow: 2, alpha: 0.95, jitter: 0.8 })), splat(3, 1.1), petals(4, 0.26)] },
  /** Re-thrown each second while the veil stands: slow ink smoke filling its circle. */
  "assassin.smoke": { tier: "ability", layers: [ink(P("smoke", [8, 10], [1.05, 1.15], [1.4, 2], { speed: [0.1, 0.4], up: [0.1, 0.3], drag: 2, grow: 1.4, alpha: 0.9, jitter: 2.4 }), { lift: 0.4 })] },
  "assassin.execute": { tier: "heavy", layers: [brush(2.4, 0.32, 1), glow(P("slash", [1, 1], [0.24, 0.24], [2.2, 2.2], { grow: 1.1 }), { lift: 1 }), star(2, 0.26), splat(4, 1), heavyLines, petals(6, 0.3)] },
  "assassin.ultCast": { tier: "ult", layers: [decal("ink", 4.5, 1.2), glow(P("lotusPetal", [30, 34], [0.5, 0.6], [0.24, 0.32], { speed: [-5, -3.5], jitter: 4, spin: 4, grow: 0.6, rise: [0.2, 2.2] }), { lift: 0.2 }),
    ink(P("smoke", [8, 10], [0.6, 0.8], [1.2, 1.8], { speed: [0.5, 1.5], drag: 2, grow: 1.6, alpha: 0.8, jitter: 1.6 }), { lift: 0.5 }), { kind: "light", intensity: 20, distance: 10, life: 0.6 }] },
  /** Every cut at once (played on each enemy the lotus caught). */
  "assassin.lotusCut": { tier: "ult", layers: [brush(2.8, 0.36, 1), brush(2.2, 0.32, 1.2), glow(P("slash", [1, 1], [0.3, 0.3], [2.6, 2.6], { grow: 1.15 }), { lift: 1 }), star(2.4, 0.3), splat(3, 1.1), petals(8, 0.32, { speed: [2, 4] }), heavyLines] },
  "assassin.ultDecal": { tier: "ult", layers: [decal("ink", 6, 4, { spin: 0.1 }), decal("rune", 3, 2, { spin: 0.3 })] },
};

export const FX: Record<string, FxRecipe> = {
  // ── Hits by tier (impact.ts): a small spark, a spark burst in the ramp, the heavy tier's lines and ring ──
  "hit.light": { tier: "light", layers: [glow(P("flare", [1, 1], [0.14, 0.16], [0.45, 0.55]), { lift: 0.7 })] },
  "hit.ability": { tier: "ability", layers: [sparks(1, 0.9), glow(P("flare", [1, 1], [0.16, 0.18], [0.6, 0.7]), { lift: 0.7 })] },
  "hit.heavy": { tier: "heavy", layers: [star(1.6), sparks(2, 1.3), heavyLines, ring(0.3, 2.2, 0.3, { lift: 0.4 })] },
  // ── The dev demo kit (lib/combat/demoKit.ts) ──
  "demo.cast": { tier: "ability", layers: [halo(0.9, 0.3, 0.9), glow(P("swirl", [1, 1], [0.3, 0.3], [1, 1.1], { grow: 0.7 }), { lift: 0.9 })] },
  /** A travel recipe is thrown along a shot every frame it flies (a few short-lived sprites: a glowing wake). */
  "demo.bolt": { tier: "ability", layers: [glow(P("mote", [1, 1], [0.22, 0.26], [0.35, 0.45], { grow: 0.4 }), { lift: 0.9 }), glow(P("halo", [1, 1], [0.1, 0.12], [0.7, 0.8], { grow: 1 }), { lift: 0.9 })] },
  "demo.burst": { tier: "ability", layers: [star(1.1), sparks(2, 1), halo(1.2, 0.25)] },
  "demo.ward": { tier: "ability", layers: [{ kind: "mesh", shape: "dome", from: 0.95, to: 1.05, height: 1.3, life: 0.7 },
    glow(P("mote", [10, 12], [0.6, 0.9], [0.18, 0.26], { speed: [0.3, 0.8], up: [0.5, 1.2], jitter: 0.9, grow: 0.6 }), { lift: 0.3 })] },
  "demo.charge": { tier: "heavy", layers: [glow(P("mote", [14, 16], [0.5, 0.6], [0.2, 0.28], { speed: [-2.4, -1.8], jitter: 1.6, grow: 0.5, rise: [0.2, 1.4] })),
    glow(P("swirl", [1, 1], [0.6, 0.6], [1.2, 1.2], { grow: 0.6 }), { lift: 0.9 })] },
  "demo.slam": { tier: "heavy", layers: [star(2.6, 0.3), sparks(3, 1.6), halo(2.6, 0.3, 0.5), ring(0.5, 3.2, 0.45, { lift: 0.15, byRadius: true }),
    ink(P("debris", [6, 8], [0.7, 0.9], [0.35, 0.5], { speed: [2.5, 5], up: [3, 6], gravity: 14, drag: 0.4, spin: 6, grow: 1 })),
    ink(P("smoke", [5, 6], [0.8, 1.1], [1, 1.5], { speed: [1, 2.4], up: [0.2, 0.6], drag: 2.5, grow: 1.8, alpha: 0.85, jitter: 0.8 }), { byRadius: true })] },
  "demo.crack": { tier: "heavy", layers: [{ kind: "decal", sprite: "crack", size: 2, life: 3, byRadius: true }] },
  "demo.summon": { tier: "ability", layers: [{ kind: "decal", sprite: "rune", size: 1.6, life: 1 },
    glow(P("mote", [10, 12], [0.6, 0.8], [0.18, 0.24], { speed: [0.2, 0.6], up: [1.2, 2.2], jitter: 0.7, grow: 0.6 }))] },
  "demo.sigil": { tier: "ability", layers: [{ kind: "decal", sprite: "rune", size: 2.6, life: 1.2, spin: 0.6 }, halo(1.6, 0.5, 0.8),
    glow(P("mote", [16, 18], [0.7, 1], [0.18, 0.26], { speed: [0.2, 0.5], up: [1.4, 2.4], jitter: 1.1, grow: 0.6 }))] },
  "demo.nova": { tier: "ability", layers: [ring(0.5, 3.5, 0.35, { lift: 0.4, byRadius: true }), sparks(2, 1.4), glow(P("swirl", [1, 1], [0.35, 0.35], [2.2, 2.2], { grow: 1.6 }), { lift: 0.6 })] },
  "demo.ultCharge": { tier: "ult", layers: [{ kind: "decal", sprite: "rune", size: 3.4, life: 1 },
    glow(P("mote", [26, 30], [0.4, 0.5], [0.22, 0.3], { speed: [-4.5, -3.5], jitter: 2.6, grow: 0.4, rise: [0.1, 2] }), { lift: 0.2 }),
    glow(P("swirl", [1, 1], [0.5, 0.5], [1.6, 1.6], { grow: 0.5 }), { lift: 1 }),
    { kind: "mesh", shape: "pillar", from: 0.6, to: 0.25, height: 3.2, life: 0.5 }] },
  "demo.ultImpact": { tier: "ult", layers: [star(5, 0.4), sparks(4, 3), halo(5, 0.5, 0.6), heavyLines,
    glow(P("speedLine", [14, 16], [0.35, 0.4], [2.5, 3.2], { face: FACE.streak, aspect: 0.14, speed: [10, 14], grow: 1.6 }), { lift: 1 }),
    ring(0.6, 6.5, 0.6, { lift: 0.2, byRadius: true }), ring(0.4, 4, 0.45, { lift: 1.2 }),
    { kind: "mesh", shape: "pillar", from: 1.6, to: 2.6, height: 7, life: 0.55 }, { kind: "mesh", shape: "dome", from: 1, to: 4.6, height: 2.2, life: 0.75, byRadius: true },
    ink(P("debris", [14, 16], [0.9, 1.2], [0.4, 0.6], { speed: [4, 8], up: [5, 9], gravity: 16, drag: 0.3, spin: 7, grow: 1 })),
    ink(P("smoke", [10, 12], [1.2, 1.6], [1.6, 2.4], { speed: [2, 4], up: [0.4, 1.2], drag: 2.2, grow: 2, alpha: 0.8, jitter: 1.6 }), { byRadius: true }),
    { kind: "light", intensity: 40, distance: 12, life: 0.5 }] },
  "demo.ultDecal": { tier: "ult", layers: [{ kind: "decal", sprite: "crack", size: 2.2, life: 4, byRadius: true }, { kind: "decal", sprite: "rune", size: 1.6, life: 2, byRadius: true, spin: 0.4 }] },
  // ── Family waves ──
  ...ARCANE_FX,
  ...VANGUARD_FX,
};

/** What a recipe can cost at most (a burst throws up to 1.6× its count at full scale). */
export function recipeCost(r: FxRecipe) {
  let particles = 0, meshes = 0, decals = 0, lights = 0, life = 0, decalLife = 0;
  for (const l of r.layers) {
    if (l.kind === "particles") { particles += Math.ceil(l.recipe.count[1] * 1.6); life = Math.max(life, l.recipe.life[1]); }
    else if (l.kind === "mesh") { meshes++; life = Math.max(life, l.life); }
    else if (l.kind === "decal") { decals++; decalLife = Math.max(decalLife, l.life); }
    else { lights++; life = Math.max(life, l.life); }
  }
  return { particles, meshes, decals, lights, life, decalLife };
}

// ── Ramps: the 3-stop colour every effect maps its heat through ──
const hex = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t) as [number, number, number];
/** Heat 0 → the edge, 0.5 → the mid band, 1 → the white-hot core (sRGB 0..1); the shaders do the same. */
export function rampColor(ramp: Ramp, heat: number): [number, number, number] {
  const h = Math.min(1, Math.max(0, heat)), [core, mid, edge] = ramp.map(hex);
  return h < 0.5 ? mix(edge, mid, h / 0.5) : mix(mid, core, (h - 0.5) / 0.5);
}
/** Ground effects at most half saturated (readability rule: never a telegraph's full hue). */
export function desaturate(c: [number, number, number], keep = 0.5): [number, number, number] {
  const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return c.map(v => l + (v - l) * keep) as [number, number, number];
}
export const DEFAULT_RAMP: Ramp = ["#fff6ff", "#b48cff", "#3a2466"];

/** The ramp table the shaders sample: one row per ramp seen, 64 steps of heat each (a family wave's kits add rows as they appear). */
export const RAMP_STEPS = 64, RAMP_ROWS = 32;
/** The scene's one ramp table (the combat effects and the aura share it, and its one texture). */
export const sharedRamps = { table: null as RampTable | null };
export class RampTable {
  readonly data = new Uint8Array(RAMP_STEPS * RAMP_ROWS * 4);
  private readonly rows = new Map<string, number>();
  dirty = true;
  constructor() { this.row(DEFAULT_RAMP); }
  /** The row for a ramp (added on first sight; past 32 ramps the default's). */
  row(ramp: Ramp): number {
    const key = ramp.join();
    const known = this.rows.get(key);
    if (known !== undefined) return known;
    if (this.rows.size >= RAMP_ROWS) return 0;
    const r = this.rows.size;
    this.rows.set(key, r);
    for (let i = 0; i < RAMP_STEPS; i++) {
      const c = rampColor(ramp, i / (RAMP_STEPS - 1)), o = (r * RAMP_STEPS + i) * 4;
      this.data[o] = Math.round(c[0] * 255); this.data[o + 1] = Math.round(c[1] * 255); this.data[o + 2] = Math.round(c[2] * 255); this.data[o + 3] = 255;
    }
    this.dirty = true;
    return r;
  }
}
