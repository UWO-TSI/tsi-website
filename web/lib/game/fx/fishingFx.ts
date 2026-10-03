/**
 * The water's answer to a cast (specs/polish/fishing.md deliverable 3), from our painted pack (pack.ts): drops thrown
 * up and rings spreading on the surface where the bobber lands, a small quick ring for a nibble, a faint one now and
 * then as it floats, a standing crown of water with drops thrown high and a wide ring on the bite, rings in its wake
 * as the fish drags it, a bigger crown as the catch comes out, a swirl where one gets away. Drawn as water: tinted by
 * the water, lying on its surface (the rings) or standing on it (the crown), lit by the sun like the world's own
 * surfaces (components/game/movement/moveFx.ts). Seeded by where it happens (seedAt), so every client throws the same.
 */
import { FACE, seedAt, type ParticlePool, type Recipe } from "./particles";

const B = FACE.billboard, G = FACE.ground, S = FACE.standing;
/** The water's tints: the drops and the crown, and the brighter rings. */
export const DROP_TINT = 0xd4ecf7, RING_TINT = 0xe4f4fb, FOAM_TINT = 0xf4fbff;

const LAND_DROPS: Recipe = { sprite: "droplets", count: [3, 4], life: [0.4, 0.55], size: [0.16, 0.22], grow: 1, speed: [0.3, 0.7], spread: Math.PI, up: [1.4, 2.0], gravity: 9.8, drag: 0.8, wind: 0.1, alpha: 0.92, face: B };
const LAND_RING: Recipe = { sprite: "ripple", count: [2, 2], life: [0.85, 1.05], size: [0.42, 0.5], grow: 2.3, speed: [0, 0.05], spread: Math.PI, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.7, face: G };
const NIBBLE_RING: Recipe = { ...LAND_RING, count: [1, 1], life: [0.5, 0.6], size: [0.26, 0.3], grow: 1.9, alpha: 0.6 };
const NIBBLE_DROPS: Recipe = { ...LAND_DROPS, count: [1, 2], size: [0.1, 0.13], up: [0.8, 1.2], speed: [0.1, 0.3] };
const BOB_RING: Recipe = { ...LAND_RING, count: [1, 1], life: [1.2, 1.4], size: [0.26, 0.3], grow: 2.6, alpha: 0.32 };
const BITE_CROWN: Recipe = { sprite: "splash", count: [1, 1], life: [0.58, 0.64], size: [0.7, 0.76], grow: 1.12, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 1, face: S };
const BITE_DROPS: Recipe = { ...LAND_DROPS, count: [6, 7], life: [0.5, 0.7], size: [0.2, 0.28], speed: [0.6, 1.3], up: [2.4, 3.4], alpha: 1 };
const BITE_RING: Recipe = { ...LAND_RING, count: [2, 2], life: [0.95, 1.15], size: [0.7, 0.8], grow: 2.1, speed: [0, 0.08], alpha: 0.78 };
const WAKE_RING: Recipe = { ...LAND_RING, count: [1, 1], life: [0.6, 0.75], size: [0.28, 0.34], grow: 1.9, alpha: 0.5 };
const WAKE_DROPS: Recipe = { ...LAND_DROPS, count: [2, 3], size: [0.12, 0.16], up: [1.0, 1.6], speed: [0.4, 0.8], spread: 0.9 };
const LEAP_CROWN: Recipe = { ...BITE_CROWN, size: [1.0, 1.08], life: [0.62, 0.7] };
const LEAP_DROPS: Recipe = { ...BITE_DROPS, count: [8, 9], up: [3.0, 4.2], speed: [0.8, 1.5] };
const LEAP_RING: Recipe = { ...BITE_RING, size: [0.9, 1.0], life: [1.1, 1.3] };
const FLEE_RING: Recipe = { ...BITE_RING, count: [1, 1], size: [0.5, 0.6], alpha: 0.6 };
const FLEE_DROPS: Recipe = { ...LAND_DROPS, count: [3, 4], spread: 0.6, speed: [0.9, 1.4], up: [1.2, 1.8] };

/** Salts keep the bursts of one event apart (and one event's from another's at the same spot). */
const SALT = { land: 71, landRing: 72, nibble: 73, nibbleDrops: 74, bob: 75, bite: 76, biteDrops: 77, biteRing: 78, wake: 79, wakeDrops: 80, leap: 81, leapDrops: 82, leapRing: 83, flee: 84, fleeDrops: 85 };

/** The bobber lands: a few drops thrown up and two rings spreading on the water. */
export function bobberLands(pool: ParticlePool, x: number, waterY: number, z: number, scale = 1) {
  pool.burst(LAND_DROPS, x, waterY, z, waterY, 0, 0, scale, DROP_TINT, seedAt(x, z, SALT.land));
  pool.burst(LAND_RING, x, waterY + 0.01, z, waterY, 0, 0, scale, RING_TINT, seedAt(x, z, SALT.landRing));
}
/** A nibble: one small quick ring and a drop or two. `n` (the nibble's count) keeps two at one spot apart. */
export function bobberNibbled(pool: ParticlePool, x: number, waterY: number, z: number, n = 0) {
  pool.burst(NIBBLE_RING, x, waterY + 0.01, z, waterY, 0, 0, 1, RING_TINT, seedAt(x, z, SALT.nibble + n * 16));
  pool.burst(NIBBLE_DROPS, x, waterY, z, waterY, 0, 0, 1, DROP_TINT, seedAt(x, z, SALT.nibbleDrops + n * 16));
}
/** Floating: a faint ring now and then as it bobs (`n` counts them). */
export function bobberBobs(pool: ParticlePool, x: number, waterY: number, z: number, n = 0) {
  pool.burst(BOB_RING, x, waterY + 0.008, z, waterY, 0, 0, 1, RING_TINT, seedAt(x, z, SALT.bob + n * 16));
}
/** The bite: a crown of water standing up, drops thrown high, a wide ring. */
export function fishBites(pool: ParticlePool, x: number, waterY: number, z: number) {
  pool.burst(BITE_CROWN, x, waterY, z, waterY, 0, 0, 1, FOAM_TINT, seedAt(x, z, SALT.bite));
  pool.burst(BITE_DROPS, x, waterY, z, waterY, 0, 0, 1, DROP_TINT, seedAt(x, z, SALT.biteDrops));
  pool.burst(BITE_RING, x, waterY + 0.012, z, waterY, 0, 0, 1, RING_TINT, seedAt(x, z, SALT.biteRing));
}
/** Reeling: a ring in the bobber's wake as the fish drags it, and drops thrown back along its way when it darts. */
export function reelWake(pool: ParticlePool, x: number, waterY: number, z: number, vx: number, vz: number, n: number, darting: boolean) {
  pool.burst(WAKE_RING, x, waterY + 0.01, z, waterY, 0, 0, 1, RING_TINT, seedAt(x, z, SALT.wake + n * 16));
  if (darting) pool.burst(WAKE_DROPS, x, waterY, z, waterY, -vx, -vz, 1, DROP_TINT, seedAt(x, z, SALT.wakeDrops + n * 16));
}
/** The catch comes out of the water: a bigger crown, drops thrown higher, a wide ring. */
export function fishLeaps(pool: ParticlePool, x: number, waterY: number, z: number) {
  pool.burst(LEAP_CROWN, x, waterY, z, waterY, 0, 0, 1, FOAM_TINT, seedAt(x, z, SALT.leap));
  pool.burst(LEAP_DROPS, x, waterY, z, waterY, 0, 0, 1, DROP_TINT, seedAt(x, z, SALT.leapDrops));
  pool.burst(LEAP_RING, x, waterY + 0.012, z, waterY, 0, 0, 1, RING_TINT, seedAt(x, z, SALT.leapRing));
}
/** One got away: a swirl on the water and drops thrown the way it fled (`dirX, dirZ`). */
export function fishFlees(pool: ParticlePool, x: number, waterY: number, z: number, dirX: number, dirZ: number) {
  pool.burst(FLEE_RING, x, waterY + 0.01, z, waterY, 0, 0, 1, RING_TINT, seedAt(x, z, SALT.flee));
  pool.burst(FLEE_DROPS, x, waterY, z, waterY, dirX, dirZ, 1, DROP_TINT, seedAt(x, z, SALT.fleeDrops));
}
