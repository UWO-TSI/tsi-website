/**
 * The beach volleyball court (specs/minigames/beach-volleyball.md §1): real beach proportions scaled to our characters.
 * Everything in lib/game/volleyball works in the court's own frame: the net along x at z = 0, each team on one half
 * (z < 0 or z > 0), y the world's height. `toWorld`/`toLocal` place that frame on the island (or the lab's sand).
 */

/** Real metres to world units: a 1.75 m person is our 1.36 u character (Character.tsx CHARACTER_HEIGHT = 1.045 × 1.3). */
export const COURT_SCALE = (1.045 * 1.3) / 1.75;
const m = (v: number) => v * COURT_SCALE;
/**
 * David 2026-10-30 (phase 1 review): "the field and net needs to be bigger". The court's plan and the net's height
 * grow from the real proportions by these (the jump grows with them: match.ts COURT_TUNING).
 */
export const COURT_GROW = { plan: 1.3, net: 1.15 } as const;
const g = (v: number) => m(v) * COURT_GROW.plan, n = (v: number) => m(v) * COURT_GROW.net;

export const COURT = {
  /** Half the 16 m length (baseline to the net) and half the 8 m width. */
  halfLength: g(8), halfWidth: g(4),
  /** The net's top tape (2.43 m) and its lower edge (1 m of mesh). */
  netTop: n(2.43), netBottom: n(1.43),
  /** The posts stand 0.7 m outside the sidelines. */
  postX: g(4) + m(0.7),
  /** The free zone round the court, where players may still run. */
  free: m(3),
} as const;

/** A big inflatable beach ball (David's reference, specs/references/volleyball/beach-ball.png): 0.4 u across. */
export const BALL_R = 0.2;

export type Side = 1 | -1;
export const sideOf = (z: number): Side => (z < 0 ? -1 : 1);
/** The ball touching a line is in. */
export const inCourt = (x: number, z: number, r = BALL_R) => Math.abs(x) <= COURT.halfWidth + r && Math.abs(z) <= COURT.halfLength + r;

/** Where the court's frame sits in the world: its centre (the net's middle) and its yaw (three.js rotation.y). */
export interface CourtPlace { x: number; z: number; yaw: number }
export function toWorld(p: CourtPlace, x: number, z: number): [number, number] {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return [p.x + x * c + z * s, p.z - x * s + z * c];
}
export function toLocal(p: CourtPlace, wx: number, wz: number): [number, number] {
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = wx - p.x, dz = wz - p.z;
  return [dx * c - dz * s, dx * s + dz * c];
}
