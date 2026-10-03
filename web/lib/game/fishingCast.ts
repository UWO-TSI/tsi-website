/**
 * The cast in the world (specs/polish/fishing.md), pure so the bobber, the line and the tests share it: where a
 * throw lands (always on water, from every shore angle), and the bite's thrash as smooth seeded noise, so the same
 * cast thrashes the same way on every client (look spec §7.1). Nothing here allocates: the frame path passes its
 * own objects.
 */

/** How far past the spot a throw carries: a little at no power, about two and a half units at full. */
export const throwReach = (power: number) => 0.6 + Math.min(1, Math.max(0, power)) * 2.0;
/** Kept clear of the far bank, so the bobber and its rings sit on open water. */
export const BANK_CLEAR = 0.35;
/** How finely the throw's path is checked for land (units). */
const STEP = 0.1;

/**
 * Where a throw from (fromX, fromZ) through the water spot lands: past the spot along the throw by its reach
 * (`throwReach`), but never over land. The bobber stops on the throw's line short of the first land past the spot
 * (the far bank), keeping BANK_CLEAR from it; on narrow water that can be the spot itself. Standing on the spot, it
 * throws along +z. `isWater` is the drawn water (the organic coast, not the painted cells).
 */
export function castLanding(isWater: (x: number, z: number) => boolean, fromX: number, fromZ: number, spotX: number, spotZ: number, power: number, out = { x: 0, z: 0 }) {
  let dx = spotX - fromX, dz = spotZ - fromZ;
  const l = Math.hypot(dx, dz);
  if (l < 1e-6) { dx = 0; dz = 1; } else { dx /= l; dz /= l; }
  const reach = throwReach(power);
  let carry = reach;
  for (let k = 1; k * STEP <= reach + BANK_CLEAR + 1e-9; k++) {
    if (isWater(spotX + dx * k * STEP, spotZ + dz * k * STEP)) continue;
    carry = Math.min(reach, Math.max(0, (k - 1) * STEP - BANK_CLEAR));
    break;
  }
  out.x = spotX + dx * carry;
  out.z = spotZ + dz * carry;
  return out;
}

/** A seeded value in [-1, 1] for lattice point `n` (integer hash, the same on every client). */
function hash(n: number, seed: number): number {
  let h = Math.imul((n | 0) ^ Math.imul(seed | 0, 0x9e3779b1), 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}
/** Smooth 1D value noise in [-1, 1]: seeded lattice values eased between (continuous, with a continuous slope). */
function noise(t: number, seed: number): number {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

/** The thrash's reach across the water (units) and how far under it rides. */
export const THRASH = { reach: 0.045, depth: 0.075, bob: 0.028 };
/**
 * The bite's thrash `t` seconds into it, for the cast seeded `seed` (its landing spot: particles.ts seedAt): the
 * bobber pulled about under the surface by the fish, a quick wander (two octaves of smooth noise, about 6 and 14 Hz)
 * and a bob under the water. Offsets from where the bobber floats, written into `out`.
 */
export function thrash(t: number, seed: number, out: { x: number; y: number; z: number }) {
  const r = THRASH.reach;
  out.x = r * (0.65 * noise(t * 6.3, seed) + 0.35 * noise(t * 13.7, seed + 11));
  out.z = r * (0.65 * noise(t * 6.3, seed + 23) + 0.35 * noise(t * 13.7, seed + 37));
  out.y = -THRASH.depth + THRASH.bob * noise(t * 5.1, seed + 51);
  return out;
}
