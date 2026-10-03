/**
 * The Warden wave's effect recipes (design sheet §1.7), keyed by the names the kits give in `vfx` and the zone keys
 * (a zone's look is the recipe of its own key, thrown again while it stays: field.ts). Built from the combat pack's
 * rows (the shadow wisp, lightning bolt, leaf, sun mote, flame, feather and thorn rows are this wave's), FxMaterial
 * meshes, ground decals and pooled lights, inside each tier's budget (combat.test.ts). Colour is the event's ramp (the
 * kit's), or the recipe's own where an element has its colour (the fire totem's flame, the earthbind's dust, the
 * bloom's petals). Ground layers fade and burst outward, textured, never a filling shape with a rim.
 */
import { FACE, type Recipe } from "./particles";
import type { CombatSprite } from "./combatPack";
import type { FxLayer, FxRecipe, MeshLayer, ParticleLayer, Ramp } from "./combat";

const P = (sprite: CombatSprite, count: [number, number], life: [number, number], size: [number, number], more: Partial<Recipe<CombatSprite>> = {}): Recipe<CombatSprite> => ({
  sprite, count, life, size, grow: 1.4, speed: [0, 0], spread: Math.PI, up: [0, 0], gravity: 0, drag: 2, wind: 0, alpha: 1, face: FACE.billboard, fadeIn: 30, ...more,
});
const glow = (recipe: Recipe<CombatSprite>, more: Partial<ParticleLayer> = {}): ParticleLayer => ({ kind: "particles", pool: "glow", recipe, ...more });
const ink = (recipe: Recipe<CombatSprite>, more: Partial<ParticleLayer> = {}): ParticleLayer => ({ kind: "particles", pool: "ink", recipe, ...more });
const ring = (from: number, to: number, life: number, more: Partial<MeshLayer> = {}): MeshLayer => ({ kind: "mesh", shape: "ring", from, to, life, ...more });
const decal = (sprite: CombatSprite, size: number, life: number, more: { byRadius?: boolean; spin?: number } = {}): FxLayer => ({ kind: "decal", sprite, size, life, ...more });
const star = (size: number, life = 0.25) => glow(P("impactStar", [1, 1], [life, life], [size, size], { grow: 1.3 }), { lift: 0.7 });
const flare = (size: number, life = 0.3, lift = 0.8) => glow(P("flare", [1, 1], [life, life], [size, size], { grow: 1.2 }), { lift });
const halo = (size: number, life = 0.35, lift = 0.8) => glow(P("halo", [1, 1], [life, life], [size, size], { grow: 1.2, alpha: 0.8 }), { lift });
const lines = (n: number, size: number, life = 0.25) => glow(P("speedLine", [n, n], [life, life], [size, size * 1.3], { face: FACE.streak, aspect: 0.15, speed: [6, 9], grow: 1.6 }), { lift: 0.8 });
/** Motes, leaves, petals or wisps rising round the spot (zones and casts). */
const rising = (sprite: CombatSprite, n: number, life: number, size: number, more: Partial<Recipe<CombatSprite>> = {}, layer: Partial<ParticleLayer> = {}) =>
  glow(P(sprite, [n, n], [life * 0.8, life], [size * 0.8, size], { speed: [0.2, 0.7], up: [0.9, 1.8], jitter: 1.2, grow: 0.7, fps: 10, ...more }), layer);
const FIRE: Ramp = ["#fff4d6", "#ff8a3d", "#5a1a08"], EARTH: Ramp = ["#fff6dc", "#d6b45a", "#4a3414"], PETAL: Ramp = ["#fff4f8", "#f2a6c0", "#5a2a3a"];
const LEAF: Ramp = ["#f4ffe2", "#7fcc4f", "#1d3a12"];

export const WARDEN_FX: Record<string, FxRecipe> = {
  // ── Summoner: ink and shadow, the class green in the rims and eyes ──
  "summoner.sign": { tier: "ability", layers: [decal("rune", 1.2, 0.8, { spin: 1.2 }), glow(P("shadow", [6, 7], [0.45, 0.6], [0.5, 0.7], { speed: [0.6, 1.4], up: [0.6, 1.4], jitter: 0.4 }), { lift: 0.9 }), flare(0.9, 0.25, 1.0)] },
  "summoner.pounce": { tier: "ability", layers: [ink(P("ink", [2, 2], [0.45, 0.5], [1.1, 1.4], { grow: 1.3 }), { lift: 0.4 }), glow(P("slash", [2, 2], [0.22, 0.26], [1.2, 1.5], { spin: 2 }), { lift: 0.6 }),
    glow(P("shadow", [6, 8], [0.4, 0.55], [0.4, 0.6], { speed: [1.5, 3], up: [0.5, 1.5] }), { lift: 0.5 })] },
  "summoner.swoop": { tier: "ability", layers: [glow(P("feather", [10, 12], [0.6, 0.9], [0.3, 0.42], { speed: [1.2, 2.6], up: [0.4, 1.2], gravity: 1.5, drag: 1.5, fps: 12, spin: 3 }), { lift: 1.2 }),
    lines(8, 1.3), glow(P("shadow", [4, 5], [0.35, 0.45], [0.6, 0.8], { speed: [0.8, 1.5] }), { lift: 1.0 })] },
  "summoner.tongue": { tier: "ability", layers: [ink(P("ink", [1, 1], [0.35, 0.35], [0.8, 0.8]), { lift: 0.6 }), flare(0.6, 0.18, 0.6)] },
  "summoner.burst": { tier: "heavy", layers: [decal("crack", 2.2, 2.6, { byRadius: true }), star(2, 0.3), { kind: "mesh", shape: "spike", from: 0.7, to: 0.5, height: 2.1, life: 0.45 },
    ring(0.3, 2.2, 0.35, { lift: 0.15, byRadius: true }), ink(P("debris", [8, 10], [0.6, 0.9], [0.3, 0.45], { speed: [2, 4], up: [3, 6], gravity: 14, drag: 0.4, spin: 6, grow: 1 })),
    glow(P("shadow", [10, 12], [0.5, 0.7], [0.5, 0.8], { speed: [1, 2.5], up: [1.5, 3] }), { lift: 0.3 }), lines(10, 1.4)] },
  "summoner.rabbits": { tier: "ability", layers: [ink(P("smoke", [6, 8], [0.6, 0.8], [0.9, 1.3], { speed: [1.5, 3], up: [0.2, 0.6], drag: 2.4, grow: 1.8, alpha: 0.8, jitter: 0.6 })),
    glow(P("shadow", [8, 10], [0.5, 0.7], [0.4, 0.6], { speed: [2, 3.5], up: [0.3, 1] }), { lift: 0.4 }), flare(1.2, 0.3, 0.9)] },
  "summoner.warp": { tier: "ability", layers: [ink(P("ink", [2, 2], [0.4, 0.45], [1.2, 1.6]), { lift: 0.3 }), glow(P("shadow", [8, 10], [0.4, 0.55], [0.5, 0.75], { speed: [1.5, 3], up: [1, 2.5] }), { lift: 0.4 }), flare(1.3, 0.22, 0.9)] },
  "summoner.garden": { tier: "ability", layers: [decal("ink", 2.6, 3.2, { byRadius: true, spin: 0.2 }), rising("shadow", 14, 1.1, 0.55, {}, { byRadius: true })] },
  "summoner.ritual": { tier: "heavy", layers: [decal("rune", 2.6, 3.5, { byRadius: true, spin: 0.5 }), rising("shadow", 20, 1.4, 0.6, {}, { byRadius: true }), halo(2.2, 0.6, 0.5), ring(0.4, 2.6, 0.6, { lift: 0.1, byRadius: true })] },
  "summoner.tamed": { tier: "heavy", layers: [star(2.6, 0.35), halo(2.6, 0.6, 0.9), rising("mote", 24, 1.2, 0.35, {}, { byRadius: true }), ring(0.4, 3.2, 0.5, { lift: 0.2, byRadius: true }), lines(12, 1.6, 0.3)] },
  "summoner.ultCharge": { tier: "ult", layers: [decal("rune", 3.6, 1.2), glow(P("shadow", [30, 36], [0.45, 0.55], [0.5, 0.75], { speed: [-4.5, -3.5], jitter: 2.6, grow: 0.4, rise: [0.1, 1.8] }), { lift: 0.2 }),
    glow(P("swirl", [1, 1], [0.5, 0.5], [1.8, 1.8], { grow: 0.5 }), { lift: 0.9 }), ink(P("ink", [3, 4], [0.5, 0.6], [1.2, 1.6], { speed: [0.5, 1] }), { lift: 0.4 })] },
  "summoner.ultImpact": { tier: "ult", layers: [star(5, 0.4), halo(5, 0.5, 0.6), ring(0.6, 6.5, 0.6, { lift: 0.2, byRadius: true }), ring(0.4, 4.5, 0.45, { lift: 0.9 }),
    { kind: "mesh", shape: "dome", from: 1, to: 4.4, height: 1.6, life: 0.7, byRadius: true }, ...[0, 1, 2].map((): FxLayer => ({ kind: "mesh", shape: "spike", from: 0.5, to: 0.35, height: 2.4, life: 0.6, byRadius: true })),
    ink(P("ink", [10, 12], [0.8, 1.1], [1.2, 1.8], { speed: [3, 6], up: [0.5, 1.5], drag: 1.5 }), { byRadius: true }),
    glow(P("shadow", [40, 48], [0.9, 1.3], [0.6, 0.9], { speed: [2, 5], up: [2, 4.5] }), { byRadius: true }), lines(14, 2.6, 0.4), { kind: "light", intensity: 30, distance: 12, life: 0.6 }] },
  "summoner.ultDecal": { tier: "ult", layers: [decal("ink", 2.4, 4, { byRadius: true }), decal("rune", 1.6, 2.5, { byRadius: true, spin: 0.4 })] },
  // ── Shaman: spirit lightning (the kit's teal), the fire totem's flame, the earthbind's dust ──
  "shaman.throw": { tier: "ability", layers: [glow(P("swirl", [1, 1], [0.3, 0.3], [0.8, 0.9], { grow: 0.7 }), { lift: 1.1 }), glow(P("bolt", [2, 3], [0.15, 0.2], [0.6, 0.8], { spin: 6 }), { lift: 1.1 })] },
  "shaman.plant": { tier: "ability", layers: [decal("crack", 1.2, 2.2), ring(0.2, 1.5, 0.3, { lift: 0.1 }), ink(P("debris", [5, 6], [0.5, 0.7], [0.22, 0.32], { speed: [1.5, 3], up: [2.5, 4.5], gravity: 14, drag: 0.4, spin: 6, grow: 1 })),
    glow(P("bolt", [3, 4], [0.18, 0.22], [0.7, 0.9], { speed: [1, 2], spin: 4 }), { lift: 0.5 })] },
  "shaman.overcharge": { tier: "heavy", layers: [glow(P("bolt", [6, 8], [0.25, 0.3], [0.9, 1.2], { speed: [2, 4], spin: 5 }), { lift: 1 }), halo(1.6, 0.4, 1), glow(P("swirl", [1, 1], [0.4, 0.4], [1.4, 1.4], { grow: 0.4 }), { lift: 1 })] },
  "shaman.unload": { tier: "heavy", layers: [star(2.4, 0.32), glow(P("bolt", [8, 10], [0.25, 0.35], [1, 1.4], { speed: [3, 6], spin: 6 }), { lift: 0.8 }), ring(0.4, 2.8, 0.4, { lift: 0.2, byRadius: true }),
    { kind: "mesh", shape: "pillar", from: 0.5, to: 0.2, height: 3, life: 0.4 }, flare(2.2, 0.3, 1.1), lines(10, 1.6)] },
  "shaman.hop": { tier: "ability", layers: [ring(0.2, 1.4, 0.3, { lift: 0.05 }), glow(P("feather", [6, 8], [0.5, 0.7], [0.25, 0.35], { speed: [1, 2], up: [0.5, 1.2], gravity: 2, spin: 4, fps: 12 }), { lift: 0.2 }), flare(0.9, 0.2, 0.2)] },
  "shaman.zap": { tier: "light", layers: [flare(0.7, 0.16, 0.8), glow(P("sparkBurst", [1, 1], [0.2, 0.2], [0.7, 0.8]), { lift: 0.7 })] },
  "shaman.flame": { tier: "ability", ramp: FIRE, layers: [ring(0.3, 2.5, 0.35, { lift: 0.15, byRadius: true }), glow(P("flame", [12, 14], [0.45, 0.65], [0.5, 0.75], { speed: [1.5, 3], up: [1, 2], drag: 1.6, fps: 14 }), { lift: 0.2, byRadius: true }),
    flare(1.2, 0.25, 0.6)] },
  "shaman.quake": { tier: "ability", ramp: EARTH, layers: [decal("crack", 1.8, 2.4, { byRadius: true }), ring(0.3, 3.4, 0.45, { lift: 0.1, byRadius: true }),
    ink(P("debris", [8, 10], [0.6, 0.8], [0.22, 0.32], { speed: [1.5, 3], up: [2, 4], gravity: 12, drag: 0.4, spin: 5, grow: 1 }), { byRadius: true })] },
  "shaman.slam": { tier: "heavy", ramp: EARTH, layers: [star(2.2, 0.3), ring(0.4, 2.6, 0.4, { lift: 0.15, byRadius: true }), decal("crack", 1.6, 2.5, { byRadius: true }),
    ink(P("debris", [10, 12], [0.6, 0.9], [0.3, 0.45], { speed: [2, 4.5], up: [3, 6], gravity: 14, drag: 0.4, spin: 6, grow: 1 })), lines(10, 1.4)] },
  "shaman.trailFire": { tier: "light", ramp: FIRE, layers: [glow(P("flame", [3, 4], [0.4, 0.55], [0.45, 0.6], { up: [0.6, 1.2], jitter: 0.4, fps: 14 }), { lift: 0.1 })] },
  "shaman.ultCharge": { tier: "ult", layers: [decal("rune", 3.4, 1.2), glow(P("bolt", [12, 14], [0.2, 0.3], [0.9, 1.3], { speed: [-3, -2], jitter: 2.4, spin: 6, rise: [0.2, 2] }), { lift: 0.3 }),
    glow(P("mote", [24, 28], [0.45, 0.55], [0.22, 0.3], { speed: [-4.5, -3.5], jitter: 2.6, grow: 0.4, rise: [0.1, 2] }), { lift: 0.2 }), { kind: "mesh", shape: "pillar", from: 0.6, to: 0.25, height: 3.4, life: 0.5 }] },
  "shaman.ultImpact": { tier: "ult", layers: [star(5, 0.4), halo(5, 0.5, 0.8), ring(0.6, 6, 0.6, { lift: 0.2, byRadius: true }),
    ...[0, 1, 2].map((): FxLayer => ({ kind: "mesh", shape: "pillar", from: 0.9, to: 0.4, height: 6, life: 0.6, byRadius: true })),
    glow(P("bolt", [16, 18], [0.3, 0.45], [1.4, 2], { speed: [4, 8], spin: 6 }), { lift: 1.2, byRadius: true }), glow(P("feather", [14, 16], [0.9, 1.3], [0.35, 0.5], { speed: [2, 4], up: [2, 4], gravity: 2, fps: 12, spin: 3 }), { lift: 1.5 }),
    glow(P("flame", [14, 16], [0.6, 0.9], [0.6, 0.9], { speed: [2, 4], up: [1.5, 3], fps: 14 }), { lift: 0.3, byRadius: true }), lines(14, 2.6, 0.4),
    ink(P("debris", [12, 14], [0.8, 1.1], [0.35, 0.5], { speed: [3, 6], up: [4, 8], gravity: 15, drag: 0.3, spin: 7, grow: 1 })), { kind: "light", intensity: 36, distance: 12, life: 0.6 }] },
  "shaman.ultDecal": { tier: "ult", layers: [decal("crack", 2.2, 4, { byRadius: true }), decal("rune", 1.6, 2.5, { byRadius: true, spin: 0.4 })] },
  // ── Druid: leaves, roots and blossoms ──
  "druid.cast": { tier: "ability", layers: [glow(P("leaf", [8, 10], [0.5, 0.7], [0.25, 0.35], { speed: [0.8, 1.6], up: [0.6, 1.2], spin: 4, fps: 10 }), { lift: 1 }), halo(0.9, 0.3, 1)] },
  "druid.snare": { tier: "heavy", layers: [decal("thorn", 2.2, 3, { byRadius: true, spin: 0.3 }), ring(0.3, 2.6, 0.4, { lift: 0.1, byRadius: true }), star(1.8, 0.28),
    { kind: "mesh", shape: "spike", from: 0.5, to: 0.3, height: 1.4, life: 0.5 }, glow(P("leaf", [12, 14], [0.6, 0.9], [0.3, 0.4], { speed: [1.5, 3], up: [1.5, 3], gravity: 4, spin: 5, fps: 10 }), { lift: 0.3, byRadius: true }),
    ink(P("debris", [6, 8], [0.5, 0.8], [0.22, 0.3], { speed: [1.5, 3], up: [2, 4], gravity: 12, drag: 0.4, spin: 5, grow: 1 }))] },
  "druid.vines": { tier: "ability", layers: [decal("thorn", 2.2, 2.8, { byRadius: true, spin: 0.15 }), rising("leaf", 6, 1, 0.3, { spin: 3 }, { byRadius: true })] },
  "druid.wall": { tier: "ability", layers: [glow(P("leaf", [10, 12], [0.6, 0.9], [0.3, 0.4], { speed: [1.5, 3], up: [1, 2], gravity: 3, spin: 5, fps: 10 }), { lift: 0.4, byRadius: true }),
    ink(P("debris", [8, 10], [0.5, 0.8], [0.22, 0.3], { speed: [1.5, 3.5], up: [2, 4], gravity: 12, drag: 0.4, spin: 5, grow: 1 }), { byRadius: true }), ring(0.2, 2.4, 0.3, { lift: 0.1, byRadius: true })] },
  "druid.bloom": { tier: "ability", ramp: PETAL, layers: [decal("rune", 1.8, 2.8, { byRadius: true, spin: 0.25 }), rising("leaf", 12, 1.1, 0.28, { spin: 3 }, { byRadius: true }), halo(1.6, 0.6, 0.3)] },
  "druid.vine": { tier: "ability", layers: [glow(P("leaf", [6, 8], [0.4, 0.6], [0.25, 0.35], { speed: [2, 3.5], spin: 5, fps: 10 }), { lift: 1.2, toward: "aim" }), flare(0.8, 0.2, 1.2)] },
  "druid.wild": { tier: "ability", ramp: LEAF, layers: [decal("thorn", 2.6, 2.8, { byRadius: true, spin: 0.1 }), rising("leaf", 16, 1.1, 0.3, { spin: 3 }, { byRadius: true })] },
  "druid.tree": { tier: "ability", ramp: LEAF, layers: [decal("rune", 2.8, 2.8, { byRadius: true, spin: 0.2 }), rising("leaf", 18, 1.2, 0.34, { spin: 3 }, { byRadius: true }), rising("mote", 10, 1.1, 0.22, {}, { byRadius: true })] },
  "druid.ultCharge": { tier: "ult", layers: [decal("thorn", 3.4, 1.4), glow(P("leaf", [28, 32], [0.5, 0.6], [0.3, 0.4], { speed: [-4, -3], jitter: 2.6, grow: 0.5, rise: [0.1, 2], spin: 4, fps: 10 }), { lift: 0.2 }),
    glow(P("swirl", [1, 1], [0.55, 0.55], [1.8, 1.8], { grow: 0.5 }), { lift: 1 }), { kind: "mesh", shape: "spike", from: 0.8, to: 0.4, height: 2.8, life: 0.55 }] },
  "druid.ultImpact": { tier: "ult", ramp: PETAL, layers: [star(5, 0.4), halo(5, 0.6, 1.4), ring(0.6, 6, 0.6, { lift: 0.2, byRadius: true }), ring(0.5, 4.5, 0.5, { lift: 2.6 }),
    glow(P("leaf", [40, 48], [1, 1.5], [0.35, 0.5], { speed: [3, 7], up: [3, 6], gravity: 3, drag: 1, spin: 5, fps: 10 }), { lift: 2.5, byRadius: true }),
    glow(P("mote", [24, 28], [0.9, 1.3], [0.25, 0.35], { speed: [2, 5], up: [2, 4] }), { lift: 2.5, byRadius: true }), lines(14, 2.6, 0.4),
    { kind: "mesh", shape: "dome", from: 1, to: 4.4, height: 2, life: 0.7, byRadius: true }, { kind: "light", intensity: 30, distance: 12, life: 0.6 }] },
  "druid.ultDecal": { tier: "ult", layers: [decal("thorn", 2.6, 4, { byRadius: true, spin: 0.1 }), decal("rune", 1.8, 2.5, { byRadius: true, spin: 0.4 })] },
  // ── Priest: sunlight and wings, in the kit's gold-green ──
  "priest.mend": { tier: "ability", layers: [glow(P("sun", [1, 1], [0.45, 0.45], [1.4, 1.4], { grow: 1.2 }), { lift: 1 }), rising("mote", 14, 0.9, 0.25), halo(1.4, 0.45, 0.9)] },
  "priest.shield": { tier: "ability", layers: [{ kind: "mesh", shape: "dome", from: 0.9, to: 1.15, height: 1.4, life: 0.7 }, flare(1.4, 0.3, 1.1), rising("sun", 8, 0.8, 0.3)] },
  "priest.beamCast": { tier: "ability", layers: [halo(1.2, 0.35, 1.1), glow(P("sun", [1, 1], [0.35, 0.35], [1, 1], { grow: 1.3 }), { lift: 1.1 })] },
  "priest.beam": { tier: "ability", layers: [{ kind: "mesh", shape: "beam", from: 0.9, to: 9, life: 0.32, lift: 0.9 }, glow(P("sun", [5, 6], [0.3, 0.4], [0.3, 0.45], { speed: [3, 6], spread: 0.25 }), { lift: 0.9, toward: "aim" }),
    flare(1, 0.18, 0.9)] },
  "priest.cast": { tier: "ability", layers: [halo(1, 0.3, 1), rising("sun", 6, 0.6, 0.25)] },
  "priest.sanctify": { tier: "heavy", layers: [decal("rune", 3, 2.6, { byRadius: true, spin: 0.6 }), star(2.4, 0.3), ring(0.4, 3.2, 0.4, { lift: 0.15, byRadius: true }),
    { kind: "mesh", shape: "pillar", from: 1.2, to: 0.9, height: 3, life: 0.45, byRadius: true }, rising("sun", 16, 0.9, 0.35, {}, { byRadius: true }), lines(10, 1.6)] },
  "priest.sanctum": { tier: "ability", layers: [decal("rune", 2.6, 2.8, { byRadius: true, spin: 0.3 }), rising("sun", 12, 1.1, 0.3, {}, { byRadius: true })] },
  "priest.step": { tier: "ability", layers: [glow(P("feather", [10, 12], [0.6, 0.8], [0.3, 0.4], { speed: [1, 2.5], up: [0.5, 1.2], gravity: 1.5, spin: 4, fps: 12 }), { lift: 1 }), lines(8, 1.4), flare(1.2, 0.25, 1)] },
  "priest.trail": { tier: "ability", layers: [decal("sun", 1.2, 2.6, { spin: 0.4 }), rising("mote", 4, 0.9, 0.22)] },
  "priest.pillar": { tier: "ability", layers: [{ kind: "mesh", shape: "pillar", from: 1.4, to: 1.1, height: 6, life: 1.1, byRadius: true }, rising("sun", 14, 1.1, 0.35, {}, { byRadius: true })] },
  "priest.ultCharge": { tier: "ult", layers: [decal("rune", 3.4, 1.4, { spin: 0.8 }), glow(P("feather", [24, 28], [0.5, 0.6], [0.35, 0.45], { speed: [-4, -3], jitter: 2.4, grow: 0.5, rise: [0.5, 2.4], spin: 4, fps: 12 }), { lift: 0.4 }),
    halo(2.4, 0.55, 1.6), glow(P("sun", [1, 1], [0.55, 0.55], [2.2, 2.2], { grow: 0.6 }), { lift: 1.6 })] },
  "priest.ultImpact": { tier: "ult", layers: [star(5.5, 0.4), halo(5, 0.5, 0.8), ring(0.6, 6, 0.6, { lift: 0.2, byRadius: true }), ring(0.5, 4, 0.45, { lift: 1.4 }),
    { kind: "mesh", shape: "pillar", from: 2, to: 2.8, height: 9, life: 0.6, byRadius: true }, { kind: "mesh", shape: "dome", from: 1, to: 4.6, height: 2.2, life: 0.75, byRadius: true },
    glow(P("feather", [24, 28], [0.9, 1.3], [0.4, 0.55], { speed: [3, 6], up: [2, 5], gravity: 2, drag: 1, spin: 4, fps: 12 }), { lift: 2, byRadius: true }),
    glow(P("sun", [16, 18], [0.8, 1.1], [0.5, 0.8], { speed: [2, 5], up: [1, 3] }), { lift: 1, byRadius: true }), lines(16, 2.8, 0.4), { kind: "light", intensity: 44, distance: 14, life: 0.6 }] },
  "priest.ultDecal": { tier: "ult", layers: [decal("rune", 2.4, 4, { byRadius: true, spin: 0.3 }), decal("sun", 1.6, 3, { byRadius: true, spin: 0.5 })] },
};
