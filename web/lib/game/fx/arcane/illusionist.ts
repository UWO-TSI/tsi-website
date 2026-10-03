/** The Illusionist's effects (its kit: lib/combat/arcane/illusionist.ts). */
import type { FxRecipe } from "../combat";
import { P, R, glow, halo, ink, light, lines, mesh, ring, star } from "./shared";

export const ILLUSIONIST_FX: Record<string, FxRecipe> = {
  "illusionist.clone": { tier: R, layers: [glow(P("card", [10, 12], [0.4, 0.55], [0.22, 0.3], { speed: [2, 4], up: [1, 2.5], spin: 6, gravity: 3, fps: 16 }), { lift: 0.9 }), halo(1.4, 0.3, 0.9), mesh("pillar", 0.6, 0.3, 0.35, { height: 2 })] },
  "illusionist.swap": { tier: R, layers: [glow(P("shard", [10, 12], [0.3, 0.4], [0.18, 0.26], { speed: [2, 4], up: [0.5, 1.5], spin: 8 }), { lift: 0.8 }), mesh("pillar", 0.55, 0.1, 0.3, { height: 2.2 }), halo(1.2, 0.25, 0.9)] },
  "illusionist.ward": { tier: R, layers: [mesh("dome", 0.9, 1.05, 0.4, { height: 1.4 }), glow(P("shard", [6, 8], [0.3, 0.4], [0.15, 0.22], { speed: [1, 2], spin: 5, jitter: 0.9 }), { lift: 0.9 })] },
  "illusionist.reflect": { tier: "heavy", layers: [star(1.8, 0.25, 0.9), glow(P("shard", [14, 16], [0.4, 0.5], [0.18, 0.28], { speed: [4, 7], up: [1, 2], gravity: 6, spin: 9 }), { lift: 0.9 }), lines(10, 1.2), ring(0.3, 1.8, 0.25, 0.8, false)] },
  "illusionist.card": { tier: R, layers: [glow(P("card", [2, 3], [0.3, 0.35], [0.22, 0.28], { speed: [2, 3], spread: 0.4, spin: 10, fps: 20 }), { lift: 0.95, toward: "aim" }), halo(0.7, 0.2, 0.95)] },
  "illusionist.card.travel": { tier: R, layers: [glow(P("flare", [1, 1], [0.14, 0.16], [0.3, 0.36], { grow: 0.6 }), { lift: 0.9 })] },
  "illusionist.card.hit": { tier: R, layers: [star(1, 0.2), glow(P("card", [4, 5], [0.35, 0.45], [0.16, 0.22], { speed: [2, 4], up: [1, 2], gravity: 6, spin: 10, fps: 18 }), { lift: 0.8 })] },
  "illusionist.vanish": { tier: R, layers: [glow(P("card", [16, 20], [0.7, 0.9], [0.22, 0.32], { speed: [1.5, 3], up: [3, 5], gravity: 5, drag: 0.6, spin: 8, fps: 18, jitter: 0.4 }), { lift: 0.9 }),
    ink(P("smoke", [4, 5], [0.5, 0.6], [0.7, 1], { speed: [0.6, 1.2], up: [0.4, 0.8], grow: 1.6, alpha: 0.7 }), { lift: 0.6 }), halo(1.4, 0.3, 0.9)] },
  "illusionist.joker.cast": { tier: "heavy", layers: [glow(P("card", [10, 12], [0.4, 0.5], [0.3, 0.45], { speed: [3, 5], up: [1, 2.5], spin: 10, fps: 20 }), { lift: 1.1, toward: "aim" }), halo(1.8, 0.4, 1.1), lines(8, 1.4)] },
  /** The mirror shatters: glass bursting everywhere, a blinding glint, the rings of the break. */
  "illusionist.shatter": { tier: "ult", layers: [star(5.5, 0.4, 1.2), halo(6, 0.5, 1), lines(14, 2.6, 0.35),
    glow(P("shard", [70, 80], [0.8, 1.3], [0.25, 0.55], { speed: [5, 12], up: [2, 7], gravity: 9, drag: 0.6, spin: 9, jitter: 3 }), { lift: 1.2, byRadius: true }),
    glow(P("card", [16, 20], [0.9, 1.3], [0.25, 0.4], { speed: [3, 7], up: [3, 6], gravity: 6, spin: 8, fps: 16 }), { lift: 1.2 }),
    ring(0.5, 5.5, 0.55, 0.3), ring(0.4, 4, 0.45, 1.6, false), mesh("pillar", 2, 3, 0.45, { height: 6 }), light(40, 12, 0.5)] },
};
