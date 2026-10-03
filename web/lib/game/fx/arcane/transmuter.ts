/** The Transmuter's effects (its kit: lib/combat/arcane/transmuter.ts). */
import type { FxRecipe } from "../combat";
import { P, R, debris, decal, glow, halo, ink, light, lines, mesh, ring, smoke, sparks, star } from "./shared";

export const TRANSMUTER_FX: Record<string, FxRecipe> = {
  "transmuter.shift": { tier: R, layers: [glow(P("beast", [3, 4], [0.25, 0.3], [0.5, 0.7], { grow: 1.3, jitter: 0.3 }), { lift: 0.8 }), ink(P("smoke", [3, 4], [0.3, 0.4], [0.5, 0.7], { speed: [1, 2], grow: 1.6, alpha: 0.6 }), { lift: 0.4 }), halo(1.1, 0.2, 0.8)] },
  "transmuter.fox": { tier: R, layers: [glow(P("slash", [2, 2], [0.18, 0.22], [1.2, 1.4], { grow: 1.2 }), { lift: 0.6 }), lines(6, 1)] },
  "transmuter.crab": { tier: R, layers: [mesh("dome", 0.85, 1.0, 0.35, { height: 1 }), sparks(1, 0.9)] },
  "transmuter.wisp": { tier: R, layers: [decal("rune", 1.2, 0.6, { spin: 1 }), glow(P("flare", [4, 5], [0.25, 0.3], [0.3, 0.4], { speed: [2, 3], grow: 0.6 }), { lift: 0.8 })] },
  "transmuter.pollen": { tier: R, layers: [glow(P("mote", [18, 22], [0.5, 0.8], [0.12, 0.2], { speed: [2, 4], up: [0.5, 1.5], drag: 2, jitter: 0.8 }), { lift: 0.6, byRadius: true }), ink(P("smoke", [3, 3], [0.6, 0.7], [0.8, 1], { grow: 1.6, alpha: 0.4 }), { lift: 0.3 })] },
  "transmuter.pinch": { tier: R, layers: [glow(P("slash", [2, 2], [0.18, 0.2], [1.3, 1.5], { grow: 1.1 }), { lift: 0.5, toward: "aim" }), star(1.1, 0.2)] },
  "transmuter.slam": { tier: "heavy", layers: [star(2.4, 0.3, 0.4), ring(0.5, 3, 0.4, 0.15), debris(10), smoke(5, 1.2), lines(10, 1.2), decal("crack", 2, 2.5, { byRadius: true })] },
  "transmuter.chimera.cast": { tier: "heavy", layers: [glow(P("beast", [8, 10], [0.4, 0.5], [0.6, 0.9], { speed: [-2, -1], jitter: 1.6, rise: [0.4, 2], grow: 0.7 }), { lift: 0.3 }), halo(2.2, 0.45, 1.2), decal("rune", 2.6, 1, { spin: 0.6 })] },
  "transmuter.fuse": { tier: "heavy", layers: [star(3, 0.35, 1.2), glow(P("beast", [10, 12], [0.5, 0.7], [0.6, 0.9], { speed: [3, 6], up: [1, 3], drag: 1.5, grow: 1.2 }), { lift: 1 }), ring(0.5, 3.2, 0.45, 0.2), smoke(6, 1.6), lines(12, 1.6)] },
  "transmuter.pounce": { tier: "ult", layers: [star(6, 0.45, 0.6), halo(6, 0.5, 0.7), lines(14, 2.6, 0.35), sparks(4, 3), ring(0.6, 6, 0.6, 0.2), ring(0.4, 4, 0.45, 1.2, false),
    mesh("dome", 1, 4.4, 0.75, { height: 2.2, byRadius: true }), glow(P("beast", [12, 14], [0.6, 0.9], [0.8, 1.2], { speed: [4, 8], up: [1, 3], drag: 1, grow: 1.3 }), { lift: 1 }),
    debris(16), smoke(10, 2, 1.4), decal("crack", 2.6, 4, { byRadius: true }), light(40, 12, 0.5)] },
};
