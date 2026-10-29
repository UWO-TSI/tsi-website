/**
 * The ball (specs/minigames/beach-volleyball.md §5): a fixed-step flight with a game gravity (lighter than the
 * characters' jump, so a pass reads), the net (its mesh sends it back, its tape lets it roll over), the antennae (a
 * crossing outside them is a fault) and the sand. Launch solvers aim a contact; `predict` runs the same step ahead.
 * Court frame (court.ts). Pure: no three.js, no clock.
 */
import { BALL_R, COURT, inCourt } from "./court";

export const GRAVITY = 13;
const DRAG = 0.012;

export interface Ball { x: number; y: number; z: number; vx: number; vy: number; vz: number }
export type Ground = (x: number, z: number) => number;
export const FLAT: Ground = () => 0;

export type BallEvent =
  | { kind: "net" } | { kind: "tape" }
  /** Crossed the net's plane outside the antennae. */
  | { kind: "antenna" }
  | { kind: "land"; in: boolean; x: number; z: number };

/** One step; mutates `b`. Returns what the ball met this step, if anything. */
export function stepBall(b: Ball, dt: number, ground: Ground = FLAT): BallEvent | null {
  const z0 = b.z;
  b.vy -= GRAVITY * dt;
  const k = 1 - DRAG * dt;
  b.vx *= k; b.vy *= k; b.vz *= k;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  let hit: BallEvent | null = null;
  if (z0 !== 0 && Math.sign(b.z) !== Math.sign(z0)) {
    const ax = Math.abs(b.x);
    if (ax > COURT.halfWidth + BALL_R) hit = { kind: "antenna" };
    else if (b.y < COURT.netTop - BALL_R * 0.5 && b.y > COURT.netBottom - BALL_R) {
      // The mesh: back to the side it came from, most of its pace gone.
      b.z = Math.sign(z0) * BALL_R;
      b.vz = -b.vz * 0.25; b.vx *= 0.6; b.vy *= 0.5;
      hit = { kind: "net" };
    } else if (b.y < COURT.netTop + BALL_R && b.y >= COURT.netTop - BALL_R * 0.5) {
      // The tape: it pops up and rolls on, slower (a let plays on).
      b.vz *= 0.45; b.vy = Math.abs(b.vy) * 0.3 + 1.2;
      hit = { kind: "tape" };
    }
  }
  const g = ground(b.x, b.z) + BALL_R;
  if (b.y <= g) {
    b.y = g;
    return { kind: "land", in: inCourt(b.x, b.z), x: b.x, z: b.z };
  }
  return hit;
}

type P3 = { x: number; y: number; z: number };
export type V3 = { vx: number; vy: number; vz: number };

/** A lob from `from` that peaks at `apexY` and comes down through `to` (drag ignored: a hair short at worst). */
export function arcTo(from: P3, to: P3, apexY: number): V3 {
  const top = Math.max(apexY, from.y + 0.05, to.y + 0.05);
  const vy = Math.sqrt(2 * GRAVITY * (top - from.y));
  const t = vy / GRAVITY + Math.sqrt((2 * (top - to.y)) / GRAVITY);
  return { vx: (to.x - from.x) / t, vy, vz: (to.z - from.z) / t };
}

/** A drive from `from` through `to` at a horizontal speed (a serve, a spike). */
export function driveTo(from: P3, to: P3, speed: number): V3 {
  const d = Math.hypot(to.x - from.x, to.z - from.z), t = Math.max(0.05, d / speed);
  return { vx: (to.x - from.x) / t, vy: (to.y - from.y + 0.5 * GRAVITY * t * t) / t, vz: (to.z - from.z) / t };
}

/** The ball's height where it crosses the net's plane on this launch (null: it doesn't cross). */
export function heightAtNet(from: P3, v: V3): number | null {
  if (!v.vz || Math.sign(-from.z) !== Math.sign(v.vz)) return null;
  const t = -from.z / v.vz;
  return from.y + v.vy * t - 0.5 * GRAVITY * t * t;
}

/** Seconds until the ball comes down through height `y` (null: it never does). */
export function timeToHeight(b: Ball, y: number): number | null {
  const disc = b.vy * b.vy + 2 * GRAVITY * (b.y - y);
  if (disc < 0) return null;
  const t = (b.vy + Math.sqrt(disc)) / GRAVITY;
  return t >= 0 ? t : null;
}

/** Where the ball is `t` seconds on (drag ignored). */
export function ballAt(b: Ball, t: number): P3 {
  return { x: b.x + b.vx * t, y: b.y + b.vy * t - 0.5 * GRAVITY * t * t, z: b.z + b.vz * t };
}

/** Run the flight ahead (the same step as play, net and all) to where it lands: the landing circle. */
export function predictLanding(b: Ball, ground: Ground = FLAT, dt = 1 / 60, max = 5): { x: number; z: number; t: number; in: boolean } | null {
  const c = { ...b };
  for (let t = dt; t <= max; t += dt) {
    const e = stepBall(c, dt, ground);
    if (e?.kind === "land") return { x: c.x, z: c.z, t, in: e.in };
  }
  return null;
}
