/**
 * Movement hooks (design sheet §1.1 "Movement hooks", row 292): class skills read the movement sim's state (sliding,
 * airborne, just after a dash, fast) and extend its momentum (a push along the aim, a small hop). The dash, slide,
 * jump and glide stay everyone's (specs/movement.md); abilities only use them. Pure over the sim's state: the avatar
 * reports what the sim is doing (`MoveView`) and applies what an ability asks (`Kick`) on its next step.
 */
import type { MoveCondition } from "@/lib/combat/classes";
import type { MoveState, MoveTuning } from "@/lib/game/movement/sim";

/** What the avatar reports each frame (`height`: above the ground under you). */
export interface MoveView { mode: string; speed: number; sinceDash: number; vx: number; vz: number; height?: number }
/**
 * What abilities ask of the next step: carried speed along (dx, dz), a hop of `up` world units, a short hang in the air;
 * `to`: a blink there (the velocity carries on: momentum kept); `down`: a slam straight down out of the air.
 */
export interface Kick { dx: number; dz: number; speed: number; up: number; hang: boolean; to?: { x: number; z: number }; down?: boolean }

export const MOVE_HOOK = {
  /** A walk; "fast" is above a run. */
  walk: 7.4, fast: 9, speedFull: 16,
  /** After a dash ends, this long still counts as "afterDash". */
  afterDash: 0.35,
  /** Per cast; the movement kit's ceiling caps the result. */
  maxPush: 4, ceiling: 18,
  /** A hang at an air cast: the rise it gives (u/s) instead of pausing gravity. */
  hangLift: 1.2,
  /** "moving": above this (a jog; a run is 7.4). `fullHeight`: a height rider's full bonus. `slam`: a drop's downward speed. */
  moving: 4, fullHeight: 3, slam: 26,
} as const;

export function moveOk(when: MoveCondition | undefined, v: MoveView): boolean {
  switch (when) {
    case undefined: return true;
    case "sliding": return v.mode === "slide";
    case "airborne": return v.mode === "air" || v.mode === "glide";
    case "afterDash": return v.sinceDash <= MOVE_HOOK.afterDash;
    case "fast": return v.speed > MOVE_HOOK.fast;
    case "moving": return v.speed > MOVE_HOOK.moving || v.mode === "slide" || v.sinceDash <= MOVE_HOOK.afterDash;
  }
}
export const MOVE_NEEDS: Record<MoveCondition, string> = { sliding: "Slide first", airborne: "Jump first", afterDash: "Dash first", fast: "Get some speed", moving: "Run, slide or dash first" };

/** `scale: speed`: +0 at a walk up to +max at 16 u/s. */
export const speedBonus = (speed: number, max: number) => max * Math.min(1, Math.max(0, (speed - MOVE_HOOK.walk) / (MOVE_HOOK.speedFull - MOVE_HOOK.walk)));
/** `scale: height`: +0 on the ground up to +max from 3 u up. */
export const heightBonus = (height: number, max: number) => max * Math.min(1, Math.max(0, height / MOVE_HOOK.fullHeight));

/** Add one ability's movement to what this frame already asks for. */
export function addKick(k: Kick | null, dx: number, dz: number, speed: number, up: number, hang = false): Kick {
  const out = k ?? { dx: 0, dz: 0, speed: 0, up: 0, hang: false };
  if (speed > 0) { const l = Math.hypot(dx, dz) || 1; out.dx = dx / l; out.dz = dz / l; out.speed = Math.min(MOVE_HOOK.maxPush, out.speed + speed); }
  out.up = Math.max(out.up, up);
  out.hang ||= hang;
  return out;
}

/**
 * Apply a kick to the sim's state (between steps): the push is added along its direction and the result capped at
 * the momentum ceiling (never slowing what tech already carries); a hop leaves the ground on the jump's own gravity;
 * a hang lifts a falling body a little. No i-frames (those are the ability's, never the movement's).
 */
export function applyKick(s: MoveState, k: Kick, t: Pick<MoveTuning, "jumpHeight" | "jumpApexTime" | "momentumCeiling">) {
  if (k.to) { s.x = k.to.x; s.z = k.to.z; }
  if (k.down && (s.mode === "air" || s.mode === "glide")) { s.vy = Math.min(s.vy, -MOVE_HOOK.slam); if (s.mode === "glide") { s.mode = "air"; s.modeT = 0; } }
  if (k.speed > 0) {
    const before = Math.hypot(s.vx, s.vz), vx = s.vx + k.dx * k.speed, vz = s.vz + k.dz * k.speed, after = Math.hypot(vx, vz);
    const cap = Math.max(before, Math.min(after, t.momentumCeiling));
    const f = after > 1e-6 ? cap / after : 0;
    s.vx = vx * f; s.vz = vz * f;
    s.airMax = Math.max(s.airMax, cap);
  }
  if (k.up > 0) {
    const g = (2 * t.jumpHeight) / (t.jumpApexTime * t.jumpApexTime);
    s.vy = Math.max(s.vy, Math.sqrt(2 * g * k.up));
    if (s.mode !== "air" && s.mode !== "glide") { s.mode = "air"; s.modeT = 0; s.topY = s.y; s.coyote = 0; s.long = false; s.slideJump = false; s.airMax = Math.max(s.airMax, Math.hypot(s.vx, s.vz)); }
    s.cut = false;
  } else if (k.hang && (s.mode === "air" || s.mode === "glide")) s.vy = Math.max(s.vy, MOVE_HOOK.hangLift); // ponytail: a lift, not a gravity pause; a hang timer in the sim if it reads short
}
