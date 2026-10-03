/**
 * Shorthands for the Arcane family's effect recipes (lib/game/fx/arcane/*.ts): the combat pack's flipbooks, FxMaterial
 * meshes, ground decals and pooled lights, as layers of the FX registry (combat.ts).
 */
import { FACE, type Recipe } from "../particles";
import type { CombatSprite } from "../combatPack";
import type { FxLayer, FxRecipe, MeshLayer } from "../combat";

export const P = (sprite: CombatSprite, count: [number, number], life: [number, number], size: [number, number], more: Partial<Recipe<CombatSprite>> = {}): Recipe<CombatSprite> => ({
  sprite, count, life, size, grow: 1.4, speed: [0, 0], spread: Math.PI, up: [0, 0], gravity: 0, drag: 2, wind: 0, alpha: 1, face: FACE.billboard, fadeIn: 30, ...more,
});
export type L = Partial<Extract<FxLayer, { kind: "particles" }>>;
export const glow = (r: Recipe<CombatSprite>, more: L = {}): FxLayer => ({ kind: "particles", pool: "glow", recipe: r, ...more });
export const ink = (r: Recipe<CombatSprite>, more: L = {}): FxLayer => ({ kind: "particles", pool: "ink", recipe: r, ...more });
export const mesh = (shape: MeshLayer["shape"], from: number, to: number, life: number, more: Partial<MeshLayer> = {}): FxLayer => ({ kind: "mesh", shape, from, to, life, ...more });
export const decal = (sprite: CombatSprite, size: number, life: number, more: { byRadius?: boolean; spin?: number } = {}): FxLayer => ({ kind: "decal", sprite, size, life, ...more });
export const light = (intensity: number, distance: number, life: number): FxLayer => ({ kind: "light", intensity, distance, life });
export const halo = (size: number, life = 0.3, lift = 0.8) => glow(P("halo", [1, 1], [life, life], [size, size], { grow: 1.2, alpha: 0.8 }), { lift });
export const star = (size: number, life = 0.25, lift = 0.7) => glow(P("impactStar", [1, 1], [life, life], [size, size], { grow: 1.3 }), { lift });
export const sparks = (n: number, size: number) => glow(P("sparkBurst", [n, n], [0.22, 0.28], [size, size * 1.2], { grow: 1.6 }), { lift: 0.7 });
export const lines = (n: number, size: number, life = 0.25) => glow(P("speedLine", [n, n], [life, life], [size, size * 1.3], { face: FACE.streak, aspect: 0.15, speed: [7, 10], grow: 1.6 }), { lift: 0.8 });
export const ring = (from: number, to: number, life: number, lift = 0.25, byRadius = true) => mesh("ring", from, to, life, { lift, byRadius });
export const smoke = (n: number, size: number, life = 0.9) => ink(P("smoke", [n, n], [life * 0.8, life], [size, size * 1.4], { speed: [1, 2.2], up: [0.3, 0.8], drag: 2.4, grow: 1.8, alpha: 0.8, jitter: 0.6 }), { byRadius: true });
export const debris = (n: number) => ink(P("debris", [n, n], [0.7, 0.9], [0.3, 0.45], { speed: [2.5, 5], up: [3, 6], gravity: 14, drag: 0.4, spin: 6, grow: 1 }));
/** A hand-cast glow: a halo and a swirl gathering at the hands. */
export const cast = (sprite: CombatSprite, n = 6): FxRecipe => ({ tier: "ability", layers: [halo(0.9, 0.28, 0.95), glow(P(sprite, [n, n], [0.3, 0.42], [0.22, 0.32], { speed: [-1.8, -1.2], jitter: 0.8, rise: [0.6, 1.3], grow: 0.6 }))] });
export const R: FxRecipe["tier"] = "ability";

