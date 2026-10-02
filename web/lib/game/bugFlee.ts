/**
 * A bug's escape (specs/polish/living-village.md deliverable 4; calmer, specs/polish/world-refinement.md §1): a wary
 * hop as the tell, then a short hop up and away from whoever startled it along a curve, fading out while it is still
 * low and near, never climbing out of view. Flyers lift about a metre over two; crawlers scurry a short arc along the
 * ground and sink into the grass. Pure, written into a caller-owned pose.
 */
export const WARY_HOP = 0.32;
/** Seconds the escape takes, fading over its second half. */
export const FLEE_TIME = 1.2;
/** How far a flyer gets (along its curve) and how high it lifts before it is gone. */
export const FLEE_REACH = 2.2, FLEE_LIFT = 0.9;

/** The tell: a quick hop and settle while the bug is wary (0 at rest), over WARY_HOP seconds. */
export function waryHop(t: number): number {
  if (t < 0 || t > WARY_HOP) return 0;
  const u = t / WARY_HOP;
  return Math.sin(u * Math.PI) * (1 - u * 0.4) * 0.12;
}

export interface FleePose { x: number; y: number; z: number; yaw: number; opacity: number }

/**
 * Where a fleeing bug is `t` seconds after it took off from (x0, y0, z0), heading `dir` (radians, away from the
 * avatar), curving to `side` (±1). Flyers spring up and away and ease off (a hop, not a launch); crawlers scurry a
 * short arc along the ground and sink. Opacity fades out over the second half.
 */
export function fleeAt(x0: number, y0: number, z0: number, dir: number, side: number, crawler: boolean, t: number, out: FleePose): FleePose {
  const u = Math.min(1, Math.max(0, t / FLEE_TIME)), ease = 1 - (1 - u) * (1 - u);
  const dist = crawler ? 1.6 * ease : FLEE_REACH * ease;
  const turn = side * (crawler ? 1.1 : 1.3) * u;
  // Along the arc: integrate the heading as it turns (closed form for a heading turning linearly with distance).
  const h = dir + turn * 0.5;
  out.x = x0 + Math.sin(h) * dist; out.z = z0 + Math.cos(h) * dist;
  // A flyer's lift: quick at first, levelling off, with a flutter in it.
  out.y = crawler ? y0 - 0.08 * u : y0 + FLEE_LIFT * ease + 0.06 * Math.sin(u * Math.PI * 5) * (1 - u);
  out.yaw = dir + turn;
  out.opacity = u >= 1 ? 0 : 1 - Math.max(0, (u - 0.45) / 0.55);
  return out;
}

/**
 * The bugs out this hour, carried over a re-roll of the list (any harvest re-derives it): a bug keeps its own state
 * (fled, mid-hop) while its node still holds the same species, and only a new species in a slot (a new hour) or a new
 * slot starts fresh. Without this, every harvest put fled bugs back on their perches.
 */
export function carryBugs<T extends { id: string; sp: { key: string } }>(prev: ReadonlyMap<string, T>, next: readonly T[]): Map<string, T> {
  return new Map(next.map(b => {
    const was = prev.get(b.id);
    return [b.id, was && was.sp.key === b.sp.key ? was : b];
  }));
}
