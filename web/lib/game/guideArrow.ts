/**
 * The guide arrow (specs/launch/v1-gameplay.md t-short, t-next): a faint arrow at your feet pointing to a place in the
 * world. Shared, one owner per call: Bram while he leads the tour, a quest when you pick it in the tracker. The newest
 * guide shown wins; clearing it brings back the one under it. components/game/GuideArrow.tsx draws it.
 *
 *   const clear = showGuide("quest", { x: 12, z: -4 });         // a fixed place
 *   const clear = showGuide("bram", () => bramWhere(), { near: 9 }); // a moving one, read each frame (null hides it)
 *   clear();                                                     // or clearGuide("quest")
 */

export type XZ = { x: number; z: number };
export type GuideTarget = XZ | (() => XZ | null);
export interface GuideOptions {
  /** Closer than this (m) the arrow is gone: you can see where to go. */
  near?: number;
}

export const GUIDE_NEAR = 8;
/** Over this much further than `near` the arrow fades in to full. */
export const GUIDE_FADE = 3;

const guides: { owner: string; target: GuideTarget; near: number }[] = [];

/** Point the arrow at `target` for `owner` (replacing that owner's last). Returns its clear. */
export function showGuide(owner: string, target: GuideTarget, opts: GuideOptions = {}): () => void {
  clearGuide(owner);
  const g = { owner, target, near: opts.near ?? GUIDE_NEAR };
  guides.push(g);
  return () => { const i = guides.indexOf(g); if (i >= 0) guides.splice(i, 1); };
}

export function clearGuide(owner: string) {
  for (let i = guides.length - 1; i >= 0; i--) if (guides[i].owner === owner) guides.splice(i, 1);
}

/** The guide on top now, its target resolved (null: no arrow). */
export function guideNow(): { owner: string; at: XZ; near: number } | null {
  const g = guides.at(-1);
  if (!g) return null;
  const at = typeof g.target === "function" ? g.target() : g.target;
  return at && { owner: g.owner, at, near: g.near };
}

/** How the arrow shows from `from`: its heading (yaw, +z is 0) and how strongly (0 hidden, 1 full). */
export function guideView(from: XZ, at: XZ, near: number): { yaw: number; alpha: number } {
  const dx = at.x - from.x, dz = at.z - from.z, d = Math.hypot(dx, dz);
  return { yaw: Math.atan2(dx, dz), alpha: Math.min(1, Math.max(0, (d - near) / GUIDE_FADE)) };
}
