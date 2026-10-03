/**
 * Taking a thing from the world into a hand (specs/polish/forage-craft-museum.md): at the act's contact frame (and the
 * server's yes) it leaves where it lay in a short arc up to the picker's hand and shrinks into it, never a pop; the
 * Bag's fly-in takes it from there. The hand is the picker's own (an avatar's position and facing), so another
 * player's pickup draws the same way on their avatar. Pure; writes into caller-owned objects.
 */
export interface XYZ { x: number; y: number; z: number }
/** `t0`: performance.now() when it left the ground; `from` where it was; `to` the hand it goes to. */
export interface Lift { t0: number; from: XYZ; to: XYZ; ms: number }
/** How long the lift takes (ms), and how high its arc rises over the straight line (world units). */
export const LIFT = { ms: 300, arc: 0.22 } as const;

/** Where the hand of a character standing at `at` (its feet) facing `yaw` holds something up to look at it. */
export function handOf(at: XYZ, yaw: number, out: XYZ = { x: 0, y: 0, z: 0 }): XYZ {
  out.x = at.x + Math.sin(yaw) * 0.24;
  out.y = at.y + 0.62;
  out.z = at.z + Math.cos(yaw) * 0.24;
  return out;
}

/** The lifted thing at `now`: position and scale into `out`; false once it has gone into the hand. */
export function liftPose(l: Lift, now: number, out: { x: number; y: number; z: number; scale: number }): boolean {
  const e = Math.min(1, Math.max(0, (now - l.t0) / l.ms));
  const k = e * e * (3 - 2 * e);
  out.x = l.from.x + (l.to.x - l.from.x) * k;
  out.z = l.from.z + (l.to.z - l.from.z) * k;
  out.y = l.from.y + (l.to.y - l.from.y) * k + Math.sin(Math.PI * e) * LIFT.arc;
  // It pops up a touch as it leaves the ground, then shrinks into the hand.
  out.scale = e < 0.25 ? 1 + 0.12 * Math.sin((e / 0.25) * Math.PI) : 1 - 0.8 * ((e - 0.25) / 0.75) ** 1.4;
  return e < 1;
}
