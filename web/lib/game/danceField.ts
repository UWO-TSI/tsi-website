/**
 * Who is here and what they are doing, for the group dance sync, the music notes and the campfire's rings
 * (specs/v1-drop.md §3). The frame loop's side, in preallocated arrays: RemoteAvatars writes each remote in view at
 * priority -3 (where they stand and the motion its Character reads), DanceSync reads it at -2. The campfire publishes
 * where it is and whether it is lit; the emote wheel reads both to decide what a sit or a dance turns into.
 */
import type { CharacterMotion } from "./character/clips";

export const FIELD_MAX = 64;
export const remoteField = { n: 0, x: new Float64Array(FIELD_MAX), y: new Float64Array(FIELD_MAX), z: new Float64Array(FIELD_MAX), motion: new Array<CharacterMotion | null>(FIELD_MAX).fill(null) };

/** The driver's frame: forget last frame's list. */
export function clearRemoteField() { remoteField.n = 0; }
/** A remote this frame: where they stand (the floor under their feet) and the motion their Character reads. */
export function noteRemote(x: number, y: number, z: number, motion: CharacterMotion) {
  const f = remoteField, i = f.n;
  if (i >= FIELD_MAX) return;
  f.x[i] = x; f.y[i] = y; f.z[i] = z; f.motion[i] = motion; f.n = i + 1;
}
/** Remotes holding `pose` within `r` of (x, z), as points (the campfire's taken slots, its dancers). */
export function remotesPosed(pose: string, x: number, z: number, r: number): { x: number; z: number }[] {
  const f = remoteField, out: { x: number; z: number }[] = [];
  for (let i = 0; i < f.n; i++) if (f.motion[i]?.pose === pose && Math.hypot(f.x[i] - x, f.z[i] - z) < r) out.push({ x: f.x[i], z: f.z[i] });
  return out;
}
/** How many remotes hold `pose` within `r` of (x, z) (no allocation: every frame). */
export function countPosed(pose: string, x: number, z: number, r: number): number {
  const f = remoteField;
  let n = 0;
  for (let i = 0; i < f.n; i++) if (f.motion[i]?.pose === pose && Math.hypot(f.x[i] - x, f.z[i] - z) < r) n++;
  return n;
}

/** The campfire in the scene now: where it is and whether it is lit (null: no fire here). */
export const campfireLive: { site: { x: number; z: number } | null; lit: boolean } = { site: null, lit: false };
