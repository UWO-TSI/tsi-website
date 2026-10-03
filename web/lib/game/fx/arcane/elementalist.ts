/** The Elementalist's effects (its kit: lib/combat/arcane/elementalist.ts). */
import type { FxRecipe } from "../combat";
import { P, R, cast, debris, decal, glow, halo, ink, light, lines, mesh, ring, smoke, sparks, star } from "./shared";

export const ELEMENTALIST_FX: Record<string, FxRecipe> = {
  "elementalist.fire.cast": cast("flame"),
  "elementalist.water.cast": cast("droplet"),
  "elementalist.earth.cast": { tier: R, layers: [halo(0.9, 0.28, 0.95), ink(P("debris", [5, 6], [0.4, 0.5], [0.18, 0.26], { speed: [-1.6, -1], up: [0.5, 1.2], jitter: 0.8, rise: [0.4, 1.1], spin: 4, grow: 0.8 }))] },
  "elementalist.wind.cast": { tier: R, layers: [glow(P("swirl", [1, 1], [0.3, 0.3], [1.1, 1.1], { grow: 1.5 }), { lift: 0.5 }), lines(6, 0.9, 0.22)] },
  /** Thrown along the fireball as it flies: flame licks and a hot core. */
  "elementalist.fireball.travel": { tier: R, layers: [glow(P("flame", [1, 1], [0.22, 0.28], [0.55, 0.7], { grow: 0.5, up: [0.6, 1] }), { lift: 0.9 }), glow(P("halo", [1, 1], [0.1, 0.12], [0.8, 0.9], { grow: 1 }), { lift: 0.9 })] },
  "elementalist.fireball.burst": { tier: R, layers: [star(1.6), glow(P("flame", [10, 12], [0.45, 0.6], [0.4, 0.6], { speed: [2, 4], up: [1.5, 3], gravity: 4, drag: 1.5, grow: 0.7 }), { lift: 0.4, byRadius: true }), ring(0.4, 2.4, 0.32), smoke(4, 0.9), decal("crack", 1.6, 2.5, { byRadius: true })] },
  /** The burning ground a fireball leaves, each pulse. */
  "elementalist.burn": { tier: R, layers: [glow(P("flame", [5, 6], [0.4, 0.55], [0.3, 0.45], { jitter: 1.1, up: [0.8, 1.6], grow: 0.6 }), { lift: 0.05, byRadius: true })] },
  "elementalist.tidal-wave": { tier: R, layers: [glow(P("wave", [6, 7], [0.55, 0.7], [1.4, 1.9], { speed: [7, 9], spread: 0.35, drag: 0.5, grow: 1.3, jitter: 0.6 }), { lift: 0.5, toward: "aim" }),
    glow(P("droplet", [14, 18], [0.5, 0.7], [0.18, 0.28], { speed: [5, 9], spread: 0.5, up: [1.5, 3], gravity: 9, drag: 0.6 }), { lift: 0.5, toward: "aim" }), mesh("beam", 1, 7, 0.45, { lift: 0.1 })] },
  "elementalist.javelin.travel": { tier: R, layers: [ink(P("debris", [1, 1], [0.25, 0.3], [0.32, 0.4], { spin: 6, grow: 0.7 }), { lift: 0.9 }), glow(P("halo", [1, 1], [0.08, 0.1], [0.5, 0.6]), { lift: 0.9 })] },
  "elementalist.javelin.hit": { tier: "heavy", layers: [star(2.2, 0.3), sparks(2, 1.4), debris(8), ring(0.3, 2, 0.3), smoke(4, 1.1), lines(10, 1.2)] },
  "elementalist.gale": { tier: R, layers: [ring(0.3, 2, 0.3, 0.3), glow(P("swirl", [1, 1], [0.35, 0.35], [1.4, 1.4], { grow: 1.6 }), { lift: 0.4 }), ink(P("smoke", [4, 5], [0.4, 0.5], [0.5, 0.8], { speed: [3, 5], drag: 3, grow: 1.8, alpha: 0.5 }), { lift: 0.2 })] },
  "elementalist.airstep": { tier: R, layers: [ring(0.2, 1.4, 0.25, 0.0, false), glow(P("swirl", [1, 1], [0.25, 0.25], [1, 1], { grow: 1.5 }), { lift: -0.1 }), lines(5, 0.7, 0.2)] },
  "elementalist.steam.cast": cast("cloud", 5),
  /** The veil round you, each pulse: soft steam billows (ink over the scene) and a few scalding glints. */
  "elementalist.steam": { tier: R, layers: [ink(P("cloud", [5, 6], [0.8, 1.1], [1.1, 1.6], { jitter: 2.4, speed: [0.2, 0.6], up: [0.2, 0.5], drag: 2, grow: 1.4, alpha: 0.6 }), { lift: 0.4, byRadius: true }),
    glow(P("mote", [4, 5], [0.5, 0.7], [0.12, 0.18], { jitter: 2.2, up: [0.5, 1], grow: 0.6 }), { lift: 0.6 })] },
  /** The tornado, each pulse: a spinning column of flame and a dust skirt. */
  "elementalist.tornado": { tier: R, layers: [glow(P("swirl", [2, 2], [0.36, 0.36], [1.6, 2.1], { grow: 1.1, rise: [0.2, 1.8] }), { lift: 0.3 }),
    glow(P("flame", [8, 9], [0.32, 0.4], [0.4, 0.6], { jitter: 0.8, up: [3, 5], speed: [1.5, 2.5], drag: 1, rise: [0, 1.2], grow: 0.6 }), { lift: 0.1 }), ink(P("smoke", [2, 3], [0.4, 0.5], [0.7, 0.9], { speed: [1.5, 2.5], grow: 1.6, alpha: 0.6 }), { lift: 0.05 })] },
  "elementalist.pillars": { tier: "heavy", layers: [mesh("beam", 1, 8, 0.5, { lift: 0.05 }), glow(P("flame", [18, 22], [0.5, 0.7], [0.5, 0.75], { speed: [6, 9], spread: 0.2, up: [3, 5.5], gravity: 6, drag: 1, grow: 0.8 }), { lift: 0.1, toward: "aim" }),
    debris(10), smoke(5, 1.1), lines(10, 1.1), decal("crack", 2.4, 3)] },
  "elementalist.lava": { tier: R, layers: [glow(P("flame", [5, 6], [0.4, 0.5], [0.25, 0.4], { speed: [3, 7], spread: 0.15, up: [0.6, 1.2], grow: 0.6 }), { lift: 0.05, toward: "aim" }), decal("crack", 1.2, 0.6, { byRadius: true })] },
  "elementalist.grove.cast": { tier: R, layers: [decal("rune", 2.6, 1.2, { spin: 0.4 }), glow(P("petal", [12, 14], [0.7, 0.9], [0.32, 0.46], { jitter: 2, up: [0.8, 1.6], spin: 3, grow: 0.9 }), { lift: 0.2 })] },
  /** The flower ring, each pulse (every 0.5 s): its blossom edge and ground flowers outliving the next pulse so they never blink, petals rising, healing motes. */
  "elementalist.grove": { tier: R, layers: [ring(2.65, 2.8, 0.9, 0.05), decal("petal", 0.9, 1, { byRadius: true, spin: 0.3 }), glow(P("petal", [8, 9], [0.7, 0.9], [0.34, 0.48], { jitter: 2.2, up: [0.4, 0.9], spin: 2, grow: 0.9, gravity: -0.2 }), { lift: 0.1, byRadius: true }),
    glow(P("mote", [4, 5], [0.6, 0.8], [0.12, 0.18], { jitter: 1.6, up: [1, 1.6], grow: 0.6 }), { lift: 0.2 })] },
  "elementalist.riptide": { tier: R, layers: [glow(P("wave", [3, 4], [0.35, 0.45], [0.8, 1.1], { speed: [9, 12], spread: 0.15, drag: 0.2 }), { lift: 0.7, toward: "away" }), glow(P("droplet", [10, 12], [0.4, 0.5], [0.16, 0.24], { speed: [5, 8], spread: 0.6, up: [1, 2.5], gravity: 9 }), { lift: 0.7 }), star(1.2, 0.2)] },
  "elementalist.rampart": { tier: R, layers: [debris(10), smoke(4, 1.2), ring(0.4, 2.2, 0.3, 0.2), decal("crack", 2.2, 3)] },
  "mash.hit": { tier: R, layers: [mesh("pillar", 0.4, 0.15, 0.35, { height: 7 }), glow(P("flare", [1, 1], [0.25, 0.25], [1.2, 1.2], { grow: 1.4 }), { lift: 5 }), glow(P("mote", [5, 6], [0.4, 0.5], [0.15, 0.2], { up: [6, 9], jitter: 0.4 }), { lift: 0.5 })] },
  "mash.miss": { tier: R, layers: [decal("crack", 1, 1), ink(P("debris", [4, 5], [0.4, 0.5], [0.15, 0.22], { speed: [1, 2], up: [2, 3], gravity: 12, spin: 5 }), { lift: 0.1 })] },
  "elementalist.cataclysm.charge": { tier: "heavy", layers: [decal("rune", 3.4, 1.5, { spin: 0.5 }), glow(P("mote", [22, 26], [0.5, 0.6], [0.2, 0.3], { speed: [-3.5, -2.5], jitter: 2.4, rise: [0.1, 2], grow: 0.4 }), { lift: 0.2 }), halo(2, 0.6, 1.2)] },
  /** The gathering storm over the aim, every 0.35 s of the channel: dark clouds overhead, the area glowing on the ground, falling sparks of all four elements. */
  "elementalist.storm": { tier: "heavy", layers: [ink(P("cloud", [4, 5], [1.1, 1.4], [1.3, 1.9], { jitter: 5, speed: [0.2, 0.5], drag: 1, grow: 1.25, alpha: 0.72, rise: [3.4, 4.2] }), { lift: 0 }),
    ring(2.62, 2.8, 0.45, 0.06), decal("rune", 1.9, 0.5, { byRadius: true, spin: 0.2 }),
    glow(P("flare", [3, 4], [0.3, 0.4], [0.3, 0.5], { jitter: 4.5, rise: [3, 3.8], up: [-6, -4], grow: 0.6 }), { lift: 0 })] },
  "elementalist.meteor": { tier: "ult", layers: [star(6, 0.45), sparks(4, 3.2), halo(6, 0.5, 0.6), lines(14, 2.6, 0.35),
    glow(P("flame", [40, 46], [0.7, 1.1], [0.6, 1.1], { speed: [6, 12], up: [3, 8], gravity: 8, drag: 0.8, grow: 0.8 }), { lift: 0.3, byRadius: true }),
    ring(0.6, 6.5, 0.6, 0.2), ring(0.4, 4.2, 0.45, 1.2, false), mesh("pillar", 1.4, 2.8, 0.55, { height: 9 }), mesh("dome", 1, 4.8, 0.8, { height: 2.4, byRadius: true }),
    debris(16), smoke(12, 2.2, 1.6), decal("crack", 2.4, 4, { byRadius: true }), light(45, 14, 0.6)] },
  "elementalist.shockwave": { tier: "heavy", layers: [ring(0.6, 6, 0.5, 0.15), debris(14), smoke(8, 1.6), lines(12, 1.6)] },
  "elementalist.cyclone": { tier: R, layers: [glow(P("swirl", [2, 2], [0.26, 0.26], [3, 4], { grow: 0.8, rise: [0.4, 2.4] }), { lift: 0.3, byRadius: true }),
    glow(P("flame", [12, 14], [0.3, 0.4], [0.5, 0.8], { jitter: 3.2, speed: [-6, -4], up: [3, 6], rise: [0, 2], grow: 0.6 }), { lift: 0.1 })] },
  "elementalist.slam": { tier: "heavy", layers: [star(3.2, 0.3), ring(0.5, 3.4, 0.4, 0.15), glow(P("flame", [22, 26], [0.5, 0.7], [0.5, 0.8], { speed: [5, 9], up: [1, 3], drag: 1.2 }), { lift: 0.3 }), debris(10), decal("crack", 2.2, 3, { byRadius: true })] },
};
