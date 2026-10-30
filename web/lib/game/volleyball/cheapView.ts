/**
 * The cheap view of a match for everyone else (David 2026-10-30: "if youre not playing it will have default playing
 * animation to save performance"). While you play, the net sender (lib/net/sender.ts) sends a steady stand on your
 * side of the court and the held clip `vb_spectate` instead of your live movement and one-shots; spectators and
 * passers-by draw that loop with no match logic. It rides the slow state's `pose` (any clip name; no protocol or room
 * change): an older client that doesn't know the clip just stands.
 */
import { COURT, toWorld } from "./court";
import { sideOfPlayer, type Match } from "./match";
import { volley, type CourtSpot } from "./session";

/** The anim lane's default loop (vb_clips.glb, game/vb-anim). */
export const VB_SPECTATE = "vb_spectate";
/**
 * FALLBACK until vb_clips.glb lands: an existing loop that reads as a ready stance. Remove with the GLB (drive.ts asks
 * `heldClip` with the rig's own clip list, so the real clip wins as soon as it is known).
 */
export const VB_SPECTATE_FALLBACK = "CrouchIdle";

/** Where you stand in the cheap view: mid-back of your side, a little off centre (court frame). */
const STAND = { x: -1.2, depth: 0.55 } as const;

export interface Stand { x: number; y: number; z: number; yaw: number }

/** Your steady stand for this match (world), facing the net; it moves only when the sides switch. */
export function spectateStand(m: Match, spot: CourtSpot): Stand | null {
  if (m.human < 0) return null;
  const side = sideOfPlayer(m, m.human), lx = STAND.x * side, lz = side * COURT.halfLength * STAND.depth;
  const [x, z] = toWorld(spot, lx, lz);
  const [fx, fz] = toWorld({ x: 0, z: 0, yaw: spot.yaw }, 0, -side);
  return { x, y: spot.y + m.ground(lx, lz), z, yaw: Math.atan2(fx, fz) };
}

/** This client's stand while it plays a match on the island (null: not playing). */
export function matchStand(): Stand | null {
  return volley.match && volley.spot ? spectateStand(volley.match, volley.spot) : null;
}

/** A held clip a remote rig can play: the name if the rig knows it, the fallback for vb_spectate, else none. */
export function heldClip(name: string | null | undefined, known: (n: string) => boolean): string | null {
  if (!name) return null;
  if (known(name)) return name;
  return name === VB_SPECTATE && known(VB_SPECTATE_FALLBACK) ? VB_SPECTATE_FALLBACK : null;
}
