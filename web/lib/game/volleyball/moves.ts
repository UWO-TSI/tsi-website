/**
 * Which clip each volleyball move plays (the anim lane, game/vb-anim, builds the vb_* clips into vb_clips.glb with a
 * contract in ./clips.ts: names, durations, contact times). Until that lands, FALLBACK: each move borrows an existing
 * clip and a guessed contact time, clearly marked here and swapped in one place (`VB_CLIPS_READY`).
 *
 * The contact time syncs the ball to the body: a press starts the clip at once, and the touch lands as the ball reaches
 * the hands (a press may wait for it, match.ts), so the clip plays at the rate that brings its contact frame to that
 * moment (`syncRate`).
 */
import type { ClipName } from "@/lib/game/character/clips";

export type VbClip = "vb_ready" | "vb_shuffle" | "vb_serve_toss" | "vb_serve_hit" | "vb_bump" | "vb_set" | "vb_jump_set" | "vb_spike_jump"
  | "vb_spike_hit" | "vb_block" | "vb_dive" | "vb_slide_dive" | "vb_celebrate_point" | "vb_celebrate_win" | "vb_spectate";

/**
 * Flip when game/vb-anim merges (its clips.ts and vb_clips.glb): the match players then load VB_CLIPS_URL and play the
 * vb_* names; until then each move plays its FALLBACK clip below.
 */
export const VB_CLIPS_READY = false;
export const VB_CLIPS_URL = "/assets/characters/v6/base/vb_clips.glb";

/**
 * Per move: the FALLBACK clip it borrows until vb_clips.glb (and where: whole body, upper body, or held), and the
 * contract's contact time (s at playRate 1; vb-anim clips.ts, final 2026-10-30), which times the clip to the ball.
 */
export const MOVE_FALLBACK: Record<VbClip, { clip: ClipName | null; on: "play" | "upper" | "move"; contact?: number }> = {
  vb_ready: { clip: "CrouchIdle", on: "move" },
  vb_shuffle: { clip: "CrouchWalk", on: "move" },
  vb_serve_toss: { clip: "CastSwing", on: "upper", contact: 0.4 },
  vb_serve_hit: { clip: "AttackMelee", on: "upper", contact: 0.15 },
  vb_bump: { clip: "Pickup", on: "play", contact: 0.36 },
  vb_set: { clip: "Cheer", on: "upper", contact: 0.4 },
  vb_jump_set: { clip: "Cheer", on: "upper", contact: 0.26 },
  vb_spike_jump: { clip: "Jump", on: "play" },
  vb_spike_hit: { clip: "AttackMelee", on: "upper", contact: 0.18 },
  vb_block: { clip: "HoldUp", on: "upper", contact: 0.12 },
  vb_dive: { clip: "Glide", on: "move", contact: 0.35 },
  vb_slide_dive: { clip: "Slide", on: "move", contact: 0.42 },
  vb_celebrate_point: { clip: "Cheer", on: "upper" },
  vb_celebrate_win: { clip: "Cheer", on: "play" },
  vb_spectate: { clip: "CrouchIdle", on: "move" },
};

/** A clip's rate so its contact lands `inS` seconds from now (the ball's arrival), kept to a believable range. */
export const syncRate = (contact: number, inS: number) => (contact > 0 ? Math.max(0.7, Math.min(2.6, contact / Math.max(0.05, inS))) : 1);

/** The clip for a match action (the press's wind-up, a touch, a block, a dive). */
export const MOVE_OF: Record<string, VbClip> = {
  bump: "vb_bump", set: "vb_set", jumpset: "vb_jump_set", spike: "vb_spike_hit", block: "vb_block", dig: "vb_dive",
  dive: "vb_dive", slide: "vb_slide_dive", toss: "vb_serve_toss", serve: "vb_serve_hit", point: "vb_celebrate_point", win: "vb_celebrate_win",
};

/** What the character plays for a move, today: the fallback clip (VB_CLIPS_READY swaps in the vb_* names). */
export function clipFor(move: VbClip): { clip: ClipName | null; on: "play" | "upper" | "move"; contact: number } {
  const f = MOVE_FALLBACK[move];
  return { clip: VB_CLIPS_READY ? (move as unknown as ClipName) : f.clip, on: f.on, contact: f.contact ?? 0 };
}
