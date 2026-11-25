/**
 * Which clip each volleyball move plays: the vb_* clips (vb-anim, vb_clips.glb, the contract in ./clips.ts), loaded
 * only on the players in a match. A press starts its clip at once, and the touch lands as the ball reaches the hands (a
 * press may wait for it, match.ts), so the clip plays at the rate that brings its contact frame to that moment
 * (`syncRate`).
 */
import { VB_CLIPS, type VbClip } from "./clips";

/** The clip for a match action (the press, a touch, a block, a dive, a serve, a point, the win). */
export const MOVE_OF: Record<string, VbClip> = {
  bump: "vb_bump", set: "vb_set", jumpset: "vb_jump_set", spike: "vb_spike_hit", block: "vb_block", dig: "vb_dive",
  dive: "vb_dive", slide: "vb_slide_dive", toss: "vb_serve_toss", serve: "vb_serve_hit", serveStand: "vb_serve_stand",
  point: "vb_celebrate_point", win: "vb_celebrate_win",
};

/** A clip's rate so its contact lands `inS` seconds from now (the ball's arrival), kept to a believable range. */
export const syncRate = (contact: number, inS: number) => (contact > 0 ? Math.max(0.7, Math.min(2.6, contact / Math.max(0.05, inS))) : 1);

/** A move's clip and its contact time (s at playRate 1; 0 for none). */
export function clipFor(move: VbClip): { clip: VbClip; contact: number } {
  const c = VB_CLIPS[move] as { contact?: number };
  return { clip: move, contact: c.contact ?? 0 };
}

/** The ready stance's held clip by your sideways speed (u/s, + to your right): still, a shuffle either way, or none (run). */
export function stanceClip(side: number, speed: number, shuffleUnder: number): VbClip | null {
  if (speed > shuffleUnder) return null;
  if (speed < 0.3) return "vb_ready";
  return side >= 0 ? "vb_shuffle" : "vb_shuffle_left";
}

/**
 * The court jump's pose: vb_spike_jump held and posed by the jump (Character's `air`, a fraction of the clip). Rising,
 * from just before the clip's take-off (the push off the sand) to its apex as the climb slows; falling, from the apex to
 * its feet-down frame as the fall quickens. Linear in the sim's time, so the body moves with the arc, never ahead of it.
 * `vy` the vertical speed, `v0` the take-off speed, `vLand` the speed at touchdown.
 */
export function jumpPose(vy: number, v0: number, vLand: number): number {
  const c = VB_CLIPS.vb_spike_jump, from = c.takeoff - 0.06;
  const t = vy > 0 ? from + (1 - Math.min(1, vy / v0)) * (c.apex - from) : c.apex + Math.min(1, -vy / vLand) * (c.land - c.apex);
  return t / c.duration;
}
