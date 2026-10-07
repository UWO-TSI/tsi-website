/**
 * Shaking a tree (specs/polish/forage-craft-museum.md deliverable 2): the wobble, as world state at the tree, and the
 * fruit or branch that falls out of it, bounces once and rolls to rest where it can be picked up.
 *
 * A shake is a slot (the tree's spot, the world-clock second it started, its strength) in a small uniform array the
 * tree shader reads (lib/game/modelMaterials addTreeSway): every tree whose root stands on a slot's spot wobbles,
 * damped, on the shared clock, so anyone looking at that tree sees the same shake. `shakeOffset` is the shader's own
 * formula for the fruit hanging in the crown (lib/game/treeFruit hangAt), so they move with the leaves round them.
 * Pure apart from the shared slots; nothing allocates per frame.
 */
import { Vector4 } from "three";

export const SHAKE_SLOTS = 4;
/** The wobble: how long it lasts (s), how fast it dies away (1/s), its two rates (rad/s), a crown's sway at full strength (world units). */
export const SHAKE = { duration: 1.6, decay: 3.4, fx: 21, fz: 16, amp: 0.13 } as const;
/** A tree whose root is within this of a slot's spot takes its shake. */
export const SHAKE_RADIUS = 0.45;

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The crown's push `age` seconds into a shake of strength `amp` (before the height falloff the shader adds), into `out`. */
export function shakeOffset(age: number, amp: number, out: { x: number; z: number }): { x: number; z: number } {
  if (age < 0 || age >= SHAKE.duration || amp <= 0) { out.x = 0; out.z = 0; return out; }
  const env = amp * Math.exp(-age * SHAKE.decay) * (1 - smooth(SHAKE.duration * 0.8, SHAKE.duration, age));
  out.x = Math.sin(age * SHAKE.fx) * env;
  out.z = Math.sin(age * SHAKE.fz + 1.3) * env * 0.7;
  return out;
}

const _o = { x: 0, z: 0 };
/** The slots: x, z (the tree), z of the vector = the world second it started, w = strength (0: free). */
export class Shakes {
  readonly uniforms: Vector4[] = Array.from({ length: SHAKE_SLOTS }, () => new Vector4(0, 0, -1e6, 0));
  /** Shake the tree at (x, z) from world second `t`: its own slot again if it's already shaking, else a free or the oldest one. */
  start(x: number, z: number, t: number, amp: number = SHAKE.amp): number {
    let slot = -1, oldest = 0;
    for (let i = 0; i < this.uniforms.length; i++) {
      const u = this.uniforms[i];
      if (u.w > 0 && Math.hypot(u.x - x, u.y - z) < SHAKE_RADIUS) { slot = i; break; }
      if (u.z < this.uniforms[oldest].z) oldest = i;
    }
    if (slot < 0) slot = oldest;
    this.uniforms[slot].set(x, z, t, amp);
    return slot;
  }
  /** The summed push on the tree at (x, z) at world second `t`, into `out`; false when it isn't shaking. */
  at(x: number, z: number, t: number, out: { x: number; z: number }): boolean {
    out.x = 0; out.z = 0;
    let any = false;
    for (let i = 0; i < this.uniforms.length; i++) {
      const u = this.uniforms[i];
      if (u.w <= 0 || Math.hypot(u.x - x, u.y - z) >= SHAKE_RADIUS) continue;
      const age = t - u.z;
      if (age < 0 || age >= SHAKE.duration) continue;
      shakeOffset(age, u.w, _o);
      out.x += _o.x; out.z += _o.z;
      any = true;
    }
    return any;
  }
  clear() { for (const u of this.uniforms) u.set(0, 0, -1e6, 0); }
}
/** The world's shakes: the tree shader's uniform and the hanging fruit both read these. */
export const WORLD_SHAKES = new Shakes();
/** The tree shader's uniform (modelMaterials addTreeSway). */
export const TREE_SHAKE = { value: WORLD_SHAKES.uniforms };

// ── What falls ─────────────────────────────────────────────────────────────
export interface XZ { x: number; z: number }
export interface Fall { x: number; y: number; z: number; spin: number }
export type FallPhase = "falling" | "bouncing" | "rolling" | "resting";
/** Gravity, the bounce's share of the landing speed, the share of the way covered in the bounce, and the roll's pace. */
export const FALL = { gravity: 9.8, bounce: 0.24, hopShare: 0.35, rollBase: 0.35, rollPerUnit: 0.55 } as const;

/**
 * Where a fruit (or a branch) that hung at `hang` comes to rest: rolled out from the trunk toward the side the shaker
 * stands on, `roll` further than it hung, clear of the trunk and short of the far side.
 */
export function restPoint(trunk: XZ, hang: XZ, shaker: XZ, roll: number): XZ {
  const hx = hang.x - trunk.x, hz = hang.z - trunk.z, hl = Math.hypot(hx, hz) || 1;
  const sx = shaker.x - trunk.x, sz = shaker.z - trunk.z, sl = Math.hypot(sx, sz) || 1;
  let dx = hx / hl + sx / sl, dz = hz / hl + sz / sl;
  const dl = Math.hypot(dx, dz);
  if (dl < 1e-6) { dx = sx / sl; dz = sz / sl; } else { dx /= dl; dz /= dl; }
  const r = Math.min(1.6, Math.max(0.8, Math.hypot(hx, hz) + roll));
  return { x: trunk.x + dx * r, z: trunk.z + dz * r };
}

/**
 * A falling thing `t` seconds after it let go: straight down from `from`, one bounce on landing (carrying it part of
 * the way), then a roll that slows to a stop at `rest`, where it stays. `radius` keeps it on the ground, never in it;
 * `spin` is how far it has turned (radians: a slow tumble in the air, then the roll). Writes `out`; returns the phase.
 */
export function fallAt(from: { x: number; y: number; z: number }, rest: XZ, groundY: number, radius: number, t: number, out: Fall): FallPhase {
  const floor = groundY + radius, height = Math.max(0, from.y - floor), g = FALL.gravity;
  const tFall = Math.sqrt((2 * height) / g);
  if (t < tFall) { out.x = from.x; out.z = from.z; out.y = from.y - 0.5 * g * t * t; out.spin = t * 2.5; return "falling"; }
  const v = g * tFall * FALL.bounce, tHop = (2 * v) / g;
  const dx = rest.x - from.x, dz = rest.z - from.z, dist = Math.hypot(dx, dz);
  const spinAtLand = tFall * 2.5;
  const u = t - tFall;
  if (u < tHop) {
    const k = (u / tHop) * FALL.hopShare;
    out.x = from.x + dx * k; out.z = from.z + dz * k; out.y = floor + v * u - 0.5 * g * u * u;
    out.spin = spinAtLand + (dist * k) / Math.max(radius, 0.02);
    return "bouncing";
  }
  const tRoll = FALL.rollBase + dist * FALL.rollPerUnit, w = u - tHop;
  if (w < tRoll) {
    const e = 1 - (1 - w / tRoll) ** 2;
    const k = FALL.hopShare + (1 - FALL.hopShare) * e;
    out.x = from.x + dx * k; out.z = from.z + dz * k; out.y = floor;
    out.spin = spinAtLand + (dist * k) / Math.max(radius, 0.02);
    return "rolling";
  }
  out.x = rest.x; out.z = rest.z; out.y = floor;
  out.spin = spinAtLand + dist / Math.max(radius, 0.02);
  return "resting";
}
/** Seconds until it rests. */
export function fallTime(fromY: number, rest: XZ, from: XZ, groundY: number, radius: number): number {
  const tFall = Math.sqrt((2 * Math.max(0, fromY - groundY - radius)) / FALL.gravity);
  const tHop = (2 * FALL.gravity * tFall * FALL.bounce) / FALL.gravity;
  return tFall + tHop + FALL.rollBase + Math.hypot(rest.x - from.x, rest.z - from.z) * FALL.rollPerUnit;
}
