/**
 * A bug's escape (specs/polish/living-village.md deliverable 4): a wary hop as the tell, then away from whoever
 * startled it along a curve, fading as it goes. Flyers climb and bank off; crawlers scurry low and sink into the
 * grass. Pure, written into a caller-owned pose.
 */
export const WARY_HOP = 0.32;
/** Seconds the escape takes, fading over its second half. */
export const FLEE_TIME = 1.5;

/** The tell: a quick hop and settle while the bug is wary (0 at rest), over WARY_HOP seconds. */
export function waryHop(t: number): number {
  if (t < 0 || t > WARY_HOP) return 0;
  const u = t / WARY_HOP;
  return Math.sin(u * Math.PI) * (1 - u * 0.4) * 0.12;
}

export interface FleePose { x: number; y: number; z: number; yaw: number; opacity: number }

/**
 * Where a fleeing bug is `t` seconds after it took off from (x0, y0, z0), heading `dir` (radians, away from the
 * avatar), curving to `side` (±1). Flyers accelerate up and away in a widening arc; crawlers scurry a short arc
 * along the ground and sink. Opacity fades out over the second half.
 */
export function fleeAt(x0: number, y0: number, z0: number, dir: number, side: number, crawler: boolean, t: number, out: FleePose): FleePose {
  const u = Math.min(1, Math.max(0, t / FLEE_TIME));
  const dist = crawler ? 1.6 * (1 - (1 - u) * (1 - u)) : 4.5 * u * u + 1.2 * u;
  const turn = side * (crawler ? 1.1 : 1.6) * u;
  // Along the arc: integrate the heading as it turns (closed form for a heading turning linearly with distance).
  const h = dir + turn * 0.5;
  out.x = x0 + Math.sin(h) * dist; out.z = z0 + Math.cos(h) * dist;
  out.y = crawler ? y0 - 0.08 * u : y0 + 2.6 * u * u + 0.5 * u;
  out.yaw = dir + turn;
  out.opacity = u >= 1 ? 0 : 1 - Math.max(0, (u - 0.45) / 0.55);
  return out;
}
