/**
 * The connectable fence (game/remodel-r2; David, 2026-10-16: "make something that can have connection location when
 * placed side by side like minecraft fences but also look cute like the first one").
 *
 * A `fence` map object with the model JOINED_FENCE is one post on its cell. Each post joins the posts beside it (one
 * cell along x or z, never diagonally) with a pair of rails, so a run draws itself as straight lengths, corners, tees,
 * crosses and ends, and a post alone stands alone. Two models (art/props/build_fence.py): the post, and the rails that
 * span one cell from post centre to post centre along x (turned a quarter for a join along z). The editors snap these
 * posts to whole cells, so side by side is exactly one apart; a hand-typed position a hair off still joins.
 *
 * Pure: the scenery (components/game/NatureModels sceneryOf), the walker (defaultIsland islandOf) and the editors share
 * it. The dump's country fences (fence-country-a/b) stay drawable for any old document, but the palettes offer this one.
 */
import type { MapObject } from "./villageMap";

export const JOINED_FENCE = "fence-joined";
/** The fences the editors' palettes place. */
export const FENCE_MODELS: readonly string[] = [JOINED_FENCE];
export const FENCE_POST_URL = "/assets/game/props/fence-post.glb";
export const FENCE_RAIL_URL = "/assets/game/props/fence-rail.glb";
/** A post's solid half extent (its foot is 0.125 round), and the rails' across. */
export const FENCE_POST_HALF = 0.13;
export const FENCE_RAIL_HALF = 0.07;
/** The post's sawn top and the upper rail's: what a jump clears. */
export const FENCE_TOP = 0.612;
export const FENCE_RAIL_TOP = 0.47;

export const isJoinedFence = (o: Pick<MapObject, "kind" | "model">) => o.kind === "fence" && o.model === JOINED_FENCE;

export interface FencePoint { x: number; z: number }
export interface FenceRail { x: number; z: number; yaw: number; a: number; b: number }
export type FenceShape = "post" | "end" | "straight" | "corner" | "tee" | "cross";

/** Positions keyed on a quarter-cell lattice: a hair off the grid lands on its cell, half a cell off does not. */
const key = (x: number, z: number) => `${Math.round(x * 4)},${Math.round(z * 4)}`;

/** The posts (one per occupied spot, the first placed wins) and a rail between every two side by side. */
export function fenceLayout(points: readonly FencePoint[]): { posts: FencePoint[]; rails: FenceRail[] } {
  const at = new Map<string, number>(), posts: FencePoint[] = [];
  for (const p of points) {
    const k = key(p.x, p.z);
    if (at.has(k)) continue;
    at.set(k, posts.length);
    posts.push({ x: p.x, z: p.z });
  }
  const rails: FenceRail[] = [];
  posts.forEach((p, a) => {
    for (const [dx, dz, yaw] of [[1, 0, 0], [0, 1, Math.PI / 2]] as const) {
      const b = at.get(key(p.x + dx, p.z + dz));
      if (b === undefined) continue;
      const q = posts[b];
      rails.push({ x: (p.x + q.x) / 2, z: (p.z + q.z) / 2, yaw, a, b });
    }
  });
  return { posts, rails };
}

/** What each point draws as, by the joins it has (for the editors and the evidence; drawing needs only the layout). */
export function fenceShapes(points: readonly FencePoint[]): FenceShape[] {
  const { posts, rails } = fenceLayout(points);
  const joins = posts.map(() => ({ x: 0, z: 0 }));
  for (const r of rails) for (const i of [r.a, r.b]) joins[i][r.yaw ? "z" : "x"]++;
  const shape = ({ x, z }: { x: number; z: number }): FenceShape => {
    const n = x + z;
    if (n === 0) return "post";
    if (n === 1) return "end";
    if (n === 2) return x === 2 || z === 2 ? "straight" : "corner";
    return n === 3 ? "tee" : "cross";
  };
  return points.map(p => shape(joins[posts.findIndex(q => key(q.x, q.z) === key(p.x, p.z))]));
}

/** Solid boxes (centre, yaw, half extents, top) for the walker: every post, and every rail from post to post. */
export function fenceSolids(points: readonly FencePoint[]) {
  const { posts, rails } = fenceLayout(points);
  return [
    ...posts.map(p => ({ x: p.x, z: p.z, yaw: 0, hw: FENCE_POST_HALF, hd: FENCE_POST_HALF, top: FENCE_TOP })),
    ...rails.map(r => ({ x: r.x, z: r.z, yaw: r.yaw, hw: 0.5, hd: FENCE_RAIL_HALF, top: FENCE_RAIL_TOP })),
  ];
}

/** The models to draw (instanced like the rest of the scenery): a post on each point, rails at their posts' mean ground. */
export function fencePlacements(points: readonly FencePoint[], ground: (x: number, z: number) => number) {
  const { posts, rails } = fenceLayout(points);
  const y = posts.map(p => ground(p.x, p.z));
  return [
    ...posts.map((p, i) => ({ url: FENCE_POST_URL, position: [p.x, y[i], p.z] as [number, number, number], rotation: 0, scale: 1 })),
    ...rails.map(r => ({ url: FENCE_RAIL_URL, position: [r.x, (y[r.a] + y[r.b]) / 2, r.z] as [number, number, number], rotation: r.yaw, scale: 1 })),
  ];
}
