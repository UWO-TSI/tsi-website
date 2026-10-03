/**
 * Taking a thing from the world into a hand (specs/polish/forage-craft-museum.md): at the act's contact frame (and the
 * server's yes) it leaves where it lay in a short arc up to the picker's hand and shrinks into it, never a pop; the
 * Bag's fly-in takes it from there. The hand is the picker's own (an avatar's position and facing), so another
 * player's pickup draws the same way on their avatar. Pure; writes into caller-owned objects.
 */
export interface XYZ { x: number; y: number; z: number }
/**
 * `t0`: performance.now() when it left the ground; `from` where it was; `to` the hand it goes to. `rise`: a dug-up
 * find first rises straight up out of its hole by `riseBy` over this many ms, turning, then goes to the hand.
 */
export interface Lift { t0: number; from: XYZ; to: XYZ; ms: number; rise?: number; riseBy?: number }
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
  const rise = l.rise ?? 0, by = l.riseBy ?? 0;
  if (rise > 0 && now - l.t0 < rise) {
    const r = Math.max(0, (now - l.t0) / rise);
    out.x = l.from.x; out.z = l.from.z;
    out.y = l.from.y + by * (1 - (1 - r) ** 3);
    out.scale = 1 + 0.08 * Math.sin(r * Math.PI);
    return true;
  }
  const e = Math.min(1, Math.max(0, (now - l.t0 - rise) / l.ms));
  const k = e * e * (3 - 2 * e), fy = l.from.y + by;
  out.x = l.from.x + (l.to.x - l.from.x) * k;
  out.z = l.from.z + (l.to.z - l.from.z) * k;
  out.y = fy + (l.to.y - fy) * k + Math.sin(Math.PI * e) * LIFT.arc;
  // It pops up a touch as it leaves the ground, then shrinks into the hand.
  out.scale = e < 0.25 ? 1 + 0.12 * Math.sin((e / 0.25) * Math.PI) : 1 - 0.8 * ((e - 0.25) / 0.75) ** 1.4;
  return e < 1;
}
