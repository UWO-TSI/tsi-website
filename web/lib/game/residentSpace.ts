/**
 * Personal space for residents (specs/polish/audit-2026-10-world.md item 14). Where a resident stops is world state
 * (their routine on the shared clock, lib/game/residentRoutine.ts); each viewer draws them a comfortable step from the
 * players they can see and off the line between their camera and them (components/game/NPC.tsx), so the shared
 * routine stays shared, as the café's patrons yield. Pure; nothing is allocated.
 */

/** How far a resident who stops somewhere keeps from any player (world units). */
export const KEEP = 1.2;
/** The camera line's half width, and how far in front of you it reaches: a resident (or their bubble) in it covers you. */
const CORRIDOR_HALF = 0.8, CORRIDOR_REACH = 3.5;

/** Is (x, z) on the line from the camera (cx, cz) to the player (px, pz), in front of them? */
export function inCorridor(x: number, z: number, cx: number, cz: number, px: number, pz: number): boolean {
  const dx = cx - px, dz = cz - pz, len = Math.hypot(dx, dz);
  if (len < 1e-6) return false;
  const ux = dx / len, uz = dz / len, rx = x - px, rz = z - pz, along = rx * ux + rz * uz;
  if (along <= 0.2 || along > Math.min(CORRIDOR_REACH, len)) return false;
  return Math.abs(rx * uz - rz * ux) < CORRIDOR_HALF;
}

/** Steps aside to try, nearest first: rings round the stop, twelve ways each. */
const RINGS = [0.5, 0.9, 1.3, 1.7, 2.1];
const STEPS = new Float64Array(RINGS.length * 24);
RINGS.forEach((r, i) => { for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; STEPS[(i * 12 + k) * 2] = Math.sin(a) * r; STEPS[(i * 12 + k) * 2 + 1] = Math.cos(a) * r; } });

/**
 * Where to stand instead of (x, z) when it's crowded (`crowded`: too close to a player, on the camera line, on another
 * resident): the nearest spot round it the body fits (`fits`) that isn't, written into `out`. False when (x, z) is
 * fine as it is, or there is nowhere better (they stay).
 */
export function roomFor(x: number, z: number, fits: (x: number, z: number) => boolean, crowded: (x: number, z: number) => boolean, out: [number, number]): boolean {
  if (!crowded(x, z)) return false;
  for (let i = 0; i < STEPS.length; i += 2) {
    const nx = x + STEPS[i], nz = z + STEPS[i + 1];
    if (!crowded(nx, nz) && fits(nx, nz)) { out[0] = nx; out[1] = nz; return true; }
  }
  return false;
}
