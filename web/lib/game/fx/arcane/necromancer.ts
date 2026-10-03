/** The Necromancer's effects (its kit: lib/combat/arcane/necromancer.ts). */
import type { FxRecipe } from "../combat";
import { P, R, decal, glow, halo, ink, light, mesh, ring, smoke, star } from "./shared";

export const NECROMANCER_FX: Record<string, FxRecipe> = {
  "necromancer.raise": { tier: R, layers: [decal("crack", 1.8, 1.5), glow(P("skull", [3, 4], [0.5, 0.6], [0.3, 0.4], { up: [1, 1.6], jitter: 1.4, grow: 0.8 }), { lift: 0.3 }), ink(P("bone", [6, 8], [0.5, 0.7], [0.15, 0.25], { speed: [1, 2], up: [2, 3.5], gravity: 9, spin: 7 }), { lift: 0.1 })] },
  "necromancer.command": { tier: R, layers: [glow(P("skull", [1, 1], [0.6, 0.6], [0.6, 0.6], { up: [0.6, 0.6], grow: 1.2 }), { lift: 2 }), ring(0.3, 1.4, 0.35, 0.1, false)] },
  "necromancer.explode": { tier: "heavy", layers: [star(2.4, 0.3), glow(P("flame", [14, 16], [0.45, 0.6], [0.45, 0.7], { speed: [3, 6], up: [2, 4], drag: 1.2 }), { lift: 0.4, byRadius: true }),
    ink(P("bone", [12, 14], [0.7, 0.9], [0.18, 0.3], { speed: [3, 6], up: [3, 6], gravity: 12, spin: 8 }), { lift: 0.4 }), ring(0.4, 2.6, 0.35), smoke(4, 1.2)] },
  "necromancer.pact": { tier: R, layers: [glow(P("swirl", [1, 1], [0.4, 0.4], [1.2, 1.2], { grow: 0.6 }), { lift: 0.9 }), mesh("dome", 0.95, 1.08, 0.5, { height: 1.4 })] },
  "necromancer.pact.drain": { tier: R, layers: [glow(P("mote", [12, 14], [0.4, 0.55], [0.16, 0.22], { speed: [3, 5], up: [0.5, 1.5], jitter: 0.5 }), { lift: 0.6, toward: "aim" }), ink(P("bone", [5, 6], [0.4, 0.5], [0.15, 0.22], { up: [1.5, 2.5], gravity: 9, spin: 6 }), { lift: 0.4 })] },
  "necromancer.surf": { tier: R, layers: [decal("crack", 1.4, 0.8), glow(P("skull", [1, 1], [0.45, 0.45], [0.8, 0.8], { up: [1, 1], grow: 1.2 }), { lift: 0.9 }),
    ink(P("bone", [10, 12], [0.4, 0.5], [0.3, 0.42], { speed: [1, 3], up: [2, 3.5], gravity: 10, spin: 7 }), { lift: 0.1 })] },
  /** Skeletal hands rising under the surf, every eighth of a second: bone thrown up round your feet, a green wake. */
  "necromancer.surf.trail": { tier: R, layers: [ink(P("bone", [4, 5], [0.35, 0.45], [0.32, 0.44], { up: [2.4, 3.4], gravity: 12, spin: 4, jitter: 0.6 }), { lift: 0 }), glow(P("mote", [3, 4], [0.35, 0.45], [0.16, 0.22], { up: [1, 2], jitter: 0.7 }), { lift: 0.1 })] },
  "necromancer.army.cast": { tier: "heavy", layers: [decal("rune", 3.2, 1.2, { spin: 0.4 }), glow(P("skull", [5, 6], [0.5, 0.6], [0.35, 0.45], { speed: [-2, -1], jitter: 2, rise: [0.4, 1.6], grow: 0.6 }), { lift: 0.2 }), halo(1.8, 0.5, 1)] },
  "necromancer.army.crack": { tier: "ult", layers: [decal("crack", 4.2, 4), decal("rune", 3, 2, { spin: 0.3 }), ring(0.6, 7, 0.7, 0.1), glow(P("mote", [40, 50], [0.8, 1.2], [0.14, 0.22], { jitter: 6, up: [1.5, 3], grow: 0.6 }), { lift: 0.1 }),
    ink(P("bone", [20, 24], [0.7, 1], [0.18, 0.28], { jitter: 5, up: [3, 5], gravity: 12, spin: 6 }), { lift: 0.1 }), light(25, 12, 0.8)] },
  /** One risen skeleton bursting (thirty go at once, so it stays small): a green flare and bone. */
  "necromancer.army.burst": { tier: R, layers: [star(1.2, 0.25, 0.5), ink(P("bone", [3, 4], [0.6, 0.8], [0.16, 0.24], { speed: [2, 4], up: [3, 6], gravity: 11, spin: 8 }), { lift: 0.5 })] },
};
