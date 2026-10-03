/**
 * The foraging effects (specs/polish/forage-craft-museum.md 2-4): what each act throws from our painted pack
 * (art/fx/build_pack.py) and in what colour, on the object it belongs to (the tree, the rock, the flower, the hole),
 * seeded by its spot so any client throws the same burst (look spec §7.1). Sizes are world units (a character stands
 * 1.36), speeds u/s. Data only: VillageLife throws them.
 */
import { FACE, type Recipe } from "./fx/particles";

const B = FACE.billboard;

// ── A rock struck with the shovel ────────────────────────────────────
/** The strike's puff off the rock's face, toward the striker. */
export const STRIKE_PUFF: Recipe = { sprite: "dust", count: [3, 4], life: [0.4, 0.55], size: [0.42, 0.56], grow: 1.6, speed: [0.6, 1.3], spread: 0.9, up: [0.3, 0.7],
  gravity: 0, drag: 4, wind: 0.5, lift: 0.2, alpha: 0.85, face: B, rise: [0.15, 0.32], jitter: 0.08 };
/** Chips knocked off it, tumbling out and down. */
export const CHIPS: Recipe = { sprite: "chip", count: [3, 4], life: [0.5, 0.7], size: [0.26, 0.34], grow: 1, speed: [1.4, 2.4], spread: 0.8, up: [1.6, 2.6],
  gravity: 9.8, drag: 0.6, wind: 0, spin: 5, alpha: 1, face: B, rise: [0.2, 0.32] };
export const ROCK_DUST = 0xd2c9b9;
/** A rock's chips in the colour of what it holds. */
export const CHIP_TINT: Record<string, number> = {
  rock_stone: 0xa59f95, rock_clay: 0xc98a66, rock_iron_nugget: 0x8b8f93, rock_gold_nugget: 0xe2bd5a, rock_crystal: 0xb6e2ee,
};

// ── A flower picked ─────────────────────────────────────────────────
/** Petals thrown up as it comes away, drifting down on the wind. */
export const PETALS: Recipe = { sprite: "petal", count: [7, 9], life: [0.9, 1.3], size: [0.16, 0.22], grow: 1, speed: [0.6, 1.3], spread: Math.PI, up: [1.4, 2.2],
  gravity: 2.2, drag: 1.8, wind: 0.8, spin: 4, fps: 10, alpha: 1, face: B, rise: [0.25, 0.4], jitter: 0.08 };
/** Each flower's petals (the cluster colours FlowerPickFX used on the applicant island). */
export const FLOWER_TINT: Record<string, number> = {
  flower_cosmos: 0xff8cb0, flower_lily: 0xf5f5f5, flower_hyacinth: 0x6ba3d6, flower_mum: 0xffd166,
  flower_rose: 0xe85050, flower_tulip: 0xff9944, flower_pansy: 0x9b6bb0, flower_windflower: 0xff6b8a,
};

// ── Something lifted off the ground (a shell, a coconut, a mushroom) ──
export const LIFT_PUFF: Recipe = { sprite: "sand", count: [1, 2], life: [0.4, 0.5], size: [0.5, 0.62], grow: 1.25, speed: [0.3, 0.6], spread: Math.PI, up: [0.4, 0.8],
  gravity: 2.5, drag: 3, wind: 0.3, alpha: 0.85, face: B, rise: [0.06, 0.12] };

// ── A rare find's tell ───────────────────────────────────────────────
/** One twinkle near it now and then (glow layer). */
export const GLINT: Recipe = { sprite: "sparkle", count: [1, 1], life: [0.55, 0.75], size: [0.3, 0.4], grow: 1, speed: [0, 0.05], spread: Math.PI, up: [0.04, 0.12],
  gravity: 0, drag: 0, wind: 0, alpha: 1, face: B };
export const GLINT_TINT = 0xfff1b8;
/** Seconds between a rare find's twinkles (each node at its own phase). */
export const GLINT_EVERY = 0.45;

// ── A find dug up ────────────────────────────────────────────────────
/** The spade's throw: a spray of sand standing up off the hole, away from the digger. */
export const SAND_BURST: Recipe = { sprite: "sandBurst", count: [1, 1], life: [0.55, 0.7], size: [1.05, 1.25], grow: 1.15, speed: [0.2, 0.5], spread: 0.5, up: [0.2, 0.4],
  gravity: 1.5, drag: 3, wind: 0.2, alpha: 1, face: FACE.standing };
/** Loose grains thrown with it. */
export const SAND_GRAINS: Recipe = { sprite: "sand", count: [2, 3], life: [0.45, 0.6], size: [0.55, 0.7], grow: 1.2, speed: [1, 1.8], spread: 0.7, up: [1.2, 2],
  gravity: 6, drag: 1.5, wind: 0.2, alpha: 0.95, face: B, rise: [0.05, 0.12] };
export const SAND_TINT = 0xd8bd85;
/** The hole decal's colour (multiplied by the painted pit and rim): the sand's own, darker. */
export const HOLE_TINT = "#a48a63";
/** How far a dug-up find rises out of its hole before it goes to the hand, and how long that takes (ms). */
export const DIG_RISE = { by: 0.4, ms: 320 } as const;

// ── Crafting at the workbench ────────────────────────────────────────
/** A hammer blow: a quick puff of sawdust with shavings jumping off it, low over the bench top. */
export const HAMMER_PUFF: Recipe = { sprite: "hammerPuff", count: [1, 1], life: [0.42, 0.52], size: [0.55, 0.68], grow: 1.3, speed: [0.2, 0.5], spread: Math.PI, up: [0.25, 0.5],
  gravity: 0, drag: 4, wind: 0.15, lift: 0.2, alpha: 1, face: B, rise: [0.04, 0.08] };
/** A few motes of sawdust with it. */
export const SAWDUST: Recipe = { sprite: "dust", count: [2, 3], life: [0.35, 0.5], size: [0.2, 0.28], grow: 1.4, speed: [0.5, 1.1], spread: Math.PI, up: [0.4, 0.9],
  gravity: 0.4, drag: 3.5, wind: 0.2, lift: 0.1, alpha: 0.8, face: B, rise: [0.03, 0.06] };
export const SAWDUST_TINT = 0xe3d2b4;
/** The finishing sparkle round the made thing (glow layer): one big glint and a few small ones thrown out round it. */
export const FINISH_GLINT: Recipe = { sprite: "glint", count: [1, 1], life: [0.8, 0.95], size: [0.95, 1.1], grow: 1.08, speed: [0, 0], spread: 0, up: [0.08, 0.14],
  gravity: 0, drag: 0, wind: 0, alpha: 1, face: B };
export const FINISH_SPARKS: Recipe = { sprite: "sparkle", count: [5, 6], life: [0.55, 0.85], size: [0.22, 0.3], grow: 1, speed: [0.7, 1.3], spread: Math.PI, up: [0.4, 1.1],
  gravity: 0.8, drag: 2.2, wind: 0.2, alpha: 1, face: B };
