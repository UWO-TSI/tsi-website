/**
 * A boat's wake and spray (specs/polish/arrival-wharf.md deliverable 3), from our painted pack (art/fx/build_pack.py:
 * foam, spray, droplets, ripple, dust): the motor's churned white water trailing from the propeller, the two arms of
 * the wake spreading off its sides, spray and drops thrown off the bow at speed, rings where it dips or bumps, a puff
 * of exhaust as the motor catches. Foam lies on the water and rides the shared swell (FACE.water); everything takes
 * the water's tint and drifts with the shared wind (the particle system). Seeded by place and time, so every client
 * sees the same wake behind the same boat (look spec §7.1); it draws on the boat that makes it.
 */
import { FACE, seedAt, type ParticlePool, type Recipe } from "./fx/particles";
import { BOAT, SEA_Y } from "./wharf";

const CHURN: Recipe = { sprite: "foam", count: [1, 1], life: [2.2, 3.0], size: [0.55, 0.75], grow: 2.3, speed: [0.25, 0.55], spread: 0.35, up: [0, 0], gravity: 0, drag: 1.6, wind: 0.12, alpha: 0.85, face: FACE.water, fadeIn: 6 };
const ARM: Recipe = { sprite: "foam", count: [1, 2], life: [1.3, 2.4], size: [0.26, 0.5], grow: 2.3, speed: [0.45, 0.9], spread: 0.28, up: [0, 0], gravity: 0, drag: 0.75, wind: 0.1, alpha: 0.42, face: FACE.water, fadeIn: 5, jitter: 0.14 };
const SPRAY: Recipe = { sprite: "spray", count: [1, 1], life: [0.45, 0.6], size: [0.7, 0.95], grow: 1.3, speed: [0.7, 1.3], spread: 0.3, up: [0.2, 0.5], gravity: 1.5, drag: 1.2, wind: 0.45, alpha: 0.85, face: FACE.standing };
const DROPS: Recipe = { sprite: "droplets", count: [2, 3], life: [0.4, 0.55], size: [0.24, 0.32], grow: 1, speed: [1.1, 1.9], spread: 0.5, up: [1.6, 2.4], gravity: 9.8, drag: 0.5, wind: 0.15, alpha: 0.9, face: FACE.billboard };
const RING: Recipe = { sprite: "ripple", count: [1, 1], life: [1.0, 1.3], size: [1.5, 1.9], grow: 1.7, speed: [0, 0.05], spread: Math.PI, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.6, face: FACE.water };
const EXHAUST: Recipe = { sprite: "dust", count: [2, 3], life: [0.7, 0.9], size: [0.3, 0.42], grow: 2.1, speed: [0.2, 0.45], spread: 0.6, up: [0.5, 0.8], gravity: 0, drag: 2, wind: 0.7, lift: 0.35, alpha: 0.55, face: FACE.billboard, jitter: 0.04 };

/** Salts so each kind of particle at a spot is its own throw. */
const SALT = { churn: 41, arm: 42, spray: 43, drops: 44, ring: 45, exhaust: 46 };
/** Off the water a hair, so foam never sinks into a trough's draw (the shader rides the swell). */
const ON_WATER = SEA_Y + 0.012;

/** The timers a boat's wake keeps (one per boat). */
export interface Wake { churn: number; arm: number; spray: number; side: number; idle: boolean }
export const newWake = (): Wake => ({ churn: 0, arm: 0, spray: 0, side: 1, idle: true });

/** A point of the boat's frame (x across, z along) in the world, given its world origin and heading. */
function hullPoint(bx: number, bz: number, x: number, z: number, yaw: number, out: { x: number; z: number }) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  out.x = bx + x * c + z * s;
  out.z = bz - x * s + z * c;
  return out;
}
const P = { x: 0, z: 0 };

/**
 * One frame of a boat's wake: `x, z, yaw` its origin and heading in the world, `speed` through the water (u/s),
 * `throttle` −1 astern … 1 ahead, `tint` the water's foam colour (sRGB hex), `t` world seconds (the seeds).
 */
export function boatWake(pool: ParticlePool, w: Wake, dt: number, x: number, z: number, yaw: number, speed: number, throttle: number, tint: number, t: number, amount = 1) {
  if (dt <= 0 || amount <= 0) return;
  const fx = Math.sin(yaw), fz = Math.cos(yaw), running = Math.abs(throttle) > 0.04;
  // The motor catching: a puff of exhaust off its top and a first boil at the propeller.
  if (running && w.idle) {
    hullPoint(x, z, BOAT.motor[0], BOAT.motor[2], yaw, P);
    pool.burst(EXHAUST, P.x, ON_WATER - BOAT.draft + BOAT.motor[1], P.z, ON_WATER, -fx, -fz, 1, 0xd9dde2, seedAt(P.x, P.z, SALT.exhaust + Math.floor(t)), 0.9 * amount);
  }
  w.idle = !running;
  // The churn behind the propeller: white water thrown aft (forward when going astern), more of it at more throttle.
  w.churn -= dt;
  if (running && w.churn <= 0) {
    w.churn = 0.05 / Math.max(0.3, Math.abs(throttle));
    hullPoint(x, z, 0, BOAT.prop, yaw, P);
    const back = throttle >= 0 ? -1 : 1;
    pool.burst(CHURN, P.x, ON_WATER, P.z, ON_WATER, fx * back, fz * back, 0.8 + 0.5 * Math.min(1, speed / 6), tint, seedAt(P.x, P.z, SALT.churn + Math.floor(t * 20)), Math.min(1, 0.45 + Math.abs(throttle) * 0.55) * amount);
  }
  // The wake's two arms off the sides, spreading outward as the boat goes on: the V behind it.
  w.arm -= dt;
  if (speed > 1.2 && w.arm <= 0) {
    w.arm = 0.045;
    const k = Math.min(1, (speed - 1.2) / 5);
    for (let side = -1; side <= 1; side += 2) {
      hullPoint(x, z, side * BOAT.beam * 0.95, 0.2, yaw, P);
      // Outward across the heading, a little aft.
      pool.burst(ARM, P.x, ON_WATER, P.z, ON_WATER, side * fz - fx * 0.35, -side * fx - fz * 0.35, 0.8 + 0.4 * k, tint, seedAt(P.x, P.z, SALT.arm + side + Math.floor(t * 13)), (0.5 + 0.5 * k) * amount);
    }
  }
  // Spray and drops off the bow at speed, side to side, faster the faster it goes.
  w.spray -= dt;
  if (speed > 2.4 && w.spray <= 0) {
    w.spray = Math.max(0.11, 0.42 - speed * 0.045);
    w.side = -w.side;
    hullPoint(x, z, w.side * 0.32, BOAT.bow - 0.2, yaw, P);
    const k = Math.min(1, (speed - 2.4) / 4.5), ox = w.side * fz + fx * 0.25, oz = -w.side * fx + fz * 0.25;
    pool.burst(SPRAY, P.x, ON_WATER + 0.02, P.z, ON_WATER, ox, oz, 0.7 + 0.5 * k, tint, seedAt(P.x, P.z, SALT.spray + Math.floor(t * 9)), (0.55 + 0.45 * k) * amount);
    pool.burst(DROPS, P.x, ON_WATER + 0.1, P.z, ON_WATER, ox, oz, 0.8 + 0.4 * k, 0xd4ecf7, seedAt(P.x, P.z, SALT.drops + Math.floor(t * 9)), (0.6 + 0.4 * k) * amount);
  }
}

/** Rings round the hull where it meets the water: someone stepping aboard or ashore (`at` the pier side), or the hull bumping the fenders. */
export function boatRings(pool: ParticlePool, x: number, z: number, yaw: number, side: number, tint: number, t: number, amount = 1) {
  for (let k = 0; k < 2; k++) {
    hullPoint(x, z, side * BOAT.beam * 0.9, k ? -0.2 : 0.9, yaw, P);
    pool.burst(RING, P.x, ON_WATER, P.z, ON_WATER, 0, 0, 0.8, tint, seedAt(P.x, P.z, SALT.ring + Math.floor(t * 4)), 0.7 * amount);
  }
}
