/**
 * The one telegraph and animation helper every enemy shares (pure, no
 * three.js). The enemy GLBs are separate named parts (art/props-enemies:
 * body → head → glow_eyes, arm_l → glow_arm_l, claw_*, lid, cap, legs,
 * tail, ring) with an emissive `telegraph` material on the glow parts, so an
 * attack is read from three things driven by the same state:
 *   - the part pose: crouch, lunge, claw sweep, spit, slam, beam, summon;
 *   - the glow: the telegraph parts pulse brighter as the windup fills;
 *   - the ground marker: sector, circle, ring marker or beam line.
 */
import type { AttackShape } from "./contract";
import { staggered, type Enemy } from "./sim";

/** Offsets in the part's local space (radians / model units); scale is on local Y. */
export interface PartPose { rx: number; ry: number; rz: number; dy: number; dz: number; sy: number }

/** Windup progress k, active progress a, recover progress r (each 0..1, 0 outside its state). */
export function progress(e: Pick<Enemy, "state" | "t" | "move">) {
  const m = e.move;
  return {
    k: e.state === "windup" ? Math.min(1, e.t / m.windup) : e.state === "active" ? 1 : 0,
    a: e.state === "active" ? Math.min(1, e.t / (m.active ?? 1)) : 0,
    r: e.state === "recover" ? Math.min(1, e.t / m.recover) : 0,
  };
}

const ease = (x: number) => x * x * (3 - 2 * x);
/** Just after the hit: 1 → 0 over the first quarter of the recover. */
const impact = (e: Pick<Enemy, "state">, r: number) => (e.state === "recover" ? Math.max(0, 1 - r * 4) : 0);

/**
 * Pose for one named part. `role` is the GLB node name; `side` mirrors the
 * left/right parts; `seed` staggers idle motion between instances.
 */
export function partPose(role: string, e: Pick<Enemy, "state" | "t" | "move">, time: number, seed = 0): PartPose | null {
  const shape: AttackShape = e.move.shape, { k, r } = progress(e), hit = impact(e, r);
  const side = /_[fb]?l$/.test(role) ? 1 : /_[fb]?r$/.test(role) ? -1 : 0; // arm_l, leg_fl, leg_br…
  const moving = e.state === "chase" || e.state === "return";
  const p: PartPose = { rx: 0, ry: 0, rz: 0, dy: 0, dz: 0, sy: 1 };
  const w = ease(k);
  switch (role.replace(/_[fb]?[lr]$/, "")) {
    case "body":
      if (moving) p.dy = Math.abs(Math.sin(time * 12 + seed)) * 0.02;
      else if (e.state === "idle") p.dy = Math.sin(time * 2 + seed) * 0.006;
      if (shape === "lunge") { p.rx = -0.3 * w + 0.25 * hit; p.dy -= 0.025 * w; p.dz = -0.03 * w + 0.12 * hit; }
      else if (shape === "slam" || shape === "smash") { p.dy += 0.05 * w - 0.05 * hit; p.rx = -0.15 * w + 0.2 * hit; }
      else if (shape === "spit") p.rx = -0.12 * w + 0.15 * hit;
      else if (shape === "sweep") p.ry = 0.25 * w * Math.sin(time * 18) - 0.4 * hit;
      if (staggered(e)) { p.rx = 0.18; p.dy = -0.04; }
      return p;
    case "head": case "eyes":
      if (shape === "spit") p.rx = -0.45 * w + 0.35 * hit;
      else if (shape === "lunge") p.rx = 0.2 * w;
      else p.rx = Math.sin(time * 1.5 + seed) * 0.05;
      if (staggered(e)) p.rx = 0.4;
      return p;
    case "claw": // sweep: raise and open outward, then snap across
      p.rz = side * (0.55 * w - 0.2 * hit);
      p.ry = side * (0.7 * w - 0.9 * hit);
      if (moving) p.rx = Math.sin(time * 10 + side) * 0.15;
      return p;
    case "arm":
      if (shape === "slam" || shape === "smash") p.rx = -2.5 * w + (e.state === "recover" ? -0.35 * hit : 0);
      else if (shape === "beam") p.rz = side * (1.25 * Math.max(w, e.state === "active" ? 1 : 0));
      else if (shape === "summon") { p.rx = -2.9 * w; p.rz = side * 0.35 * w; }
      if (moving) p.rx += Math.sin(time * 6 + side * 1.6) * 0.25;
      if (staggered(e)) { p.rx = 0.25; p.rz = side * 0.15; }
      return p;
    case "lid": // the book: pages flutter open, then snap shut
      p.rx = -(1.1 * w + Math.sin(time * 34) * 0.12 * w) + 0.1 * hit;
      if (moving) p.rx -= 0.15 + Math.abs(Math.sin(time * 9 + seed)) * 0.25;
      return p;
    case "cap": // the mushroom swells before it spits
      p.sy = 1 + 0.28 * w - 0.18 * hit;
      p.rx = -0.18 * w;
      return p;
    case "tail":
      p.ry = Math.sin(time * (moving ? 10 : 3) + seed) * (0.3 + 0.3 * w);
      p.rx = -0.4 * w;
      return p;
    case "leg": case "legs": case "foot": {
      if (!moving) return null;
      const front = /_f/.test(role) ? 1 : -1;
      p.rx = Math.sin(time * 14 + seed + (side * front > 0 ? 0 : Math.PI)) * 0.5;
      return p;
    }
    case "ring": // the wisp: spins up during the windup
      p.ry = time * 1.5 + seed + w * w * 9;
      p.rx = 0.3 * w;
      return p;
    default:
      return null;
  }
}

/**
 * Telegraph glow multiplier for the `telegraph` parts: dim at rest, pulsing
 * brighter as the windup fills, full while the beam is live, dark while
 * staggered (the opening), and never fully calm once enraged.
 */
export function glow(e: Pick<Enemy, "state" | "t" | "move" | "phase" | "deadFor">, time: number): number {
  if (e.state === "dead") return Math.max(0, 0.4 * (1 - e.deadFor / 0.6));
  if (staggered(e)) return 0.08;
  const { k } = progress(e);
  const rest = e.phase === 3 ? 0.9 + 0.35 * Math.sin(time * 9) : 0.4;
  if (e.state === "active") return 2.6;
  if (e.state === "windup") return rest + 1.9 * k + 0.35 * k * Math.sin(time * 24);
  return rest;
}

/** Ground marker for an enemy mid-attack: where (x, z), how big (r), what sector (arc around rot), how full. */
export interface Marker { x: number; z: number; r: number; arc: number; rot: number; fill: number; tone: "danger" | "summon" }
export function marker(e: Enemy): Marker | null {
  const m = e.move, { k } = progress(e);
  if (e.state === "active" && m.shape === "beam") return { x: e.x, z: e.z, r: m.range, arc: 0.22, rot: e.beam, fill: 1, tone: "danger" };
  if (e.state !== "windup") return null;
  switch (m.shape) {
    case "spit": return { x: e.aim.x, z: e.aim.z, r: 0.9, arc: Math.PI * 2, rot: 0, fill: k, tone: "danger" };
    case "smash": return { x: e.aim.x, z: e.aim.z, r: m.range, arc: Math.PI * 2, rot: 0, fill: k, tone: "danger" };
    case "slam": return { x: e.x, z: e.z, r: m.range, arc: Math.PI * 2, rot: 0, fill: k, tone: "danger" };
    case "summon": return { x: e.x, z: e.z, r: 2.6, arc: Math.PI * 2, rot: 0, fill: k, tone: "summon" };
    default: return { x: e.x, z: e.z, r: m.range, arc: m.arc, rot: e.facing, fill: k, tone: "danger" };
  }
}
