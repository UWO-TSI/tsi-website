/**
 * Animation state machine (rows 111, 139, 140): which clip a character plays.
 * Priority: a one-shot in progress (emote, forage, attack...) > a held pose
 * (sit, study, sleep, fish hold, trace, defeat) > locomotion from speed.
 * Pure so it can be tested; Character.tsx drives the mixer with it.
 */
import { CLIP_BY_NAME } from "./look";
import type { WeaponKind } from "@/lib/game/combat/contract";

export type ClipName = "Idle" | "Walk" | "Run" | "Sit" | "Study" | "Sleep" | "Fish" | "FishHold" | "Forage" | "Dig" | "Net"
  | "Wave" | "Cheer" | "Laugh" | "Sad" | "Dance" | "AttackMelee" | "AttackBow" | "AttackCast" | "DodgeRoll" | "Hit" | "Defeat" | "Trace" | "Stretch"
  | "Jump" | "Fall" | "Land" | "Roll" | "Mantle" | "Dash" | "Skid";
/** Movement clips (lib/game/movement): quick crossfades so hops and landings read on time. */
export const SNAPPY_CLIPS = new Set<ClipName>(["DodgeRoll", "Hit", "Jump", "Fall", "Land", "Roll", "Mantle", "Dash", "Skid"]);

/**
 * What the world asks of a character each frame. `speed` is ground speed in
 * world units/s; `pose` is a held clip (null = free); `play` is a one-shot
 * request that the character consumes (sets back to null) when it starts;
 * `move` is a movement state (in the air, skidding) that holds over locomotion.
 */
export interface CharacterMotion { speed: number; yaw: number; lift: number; pose?: ClipName | null; play?: ClipName | null; move?: ClipName | null;
  /** Animation clock rate (slow motion in /lab/move; 1 when unset). */
  rate?: number }

export const isLoop = (clip: ClipName) => CLIP_BY_NAME.get(clip)?.loop ?? true;

/** Idle below a crawl, Run above 1.25x walking pace (sprint is 1.85x). */
export function locomotion(speed: number, walkSpeed: number): "Idle" | "Walk" | "Run" {
  return speed < 0.08 ? "Idle" : speed > walkSpeed * 1.25 ? "Run" : "Walk";
}
/** Playback rate: locomotion follows actual ground speed so feet don't skate. */
export function tempo(clip: ClipName, speed: number, walkSpeed: number): number {
  if (clip === "Walk") return Math.min(1.6, Math.max(0.35, speed / walkSpeed));
  if (clip === "Run") return Math.min(1.4, Math.max(0.6, speed / (walkSpeed * 1.85)));
  return 1;
}

/** One-shot (if still running) > movement state > held pose > locomotion. A pose is dropped the moment the character moves. */
export function resolveClip(s: { speed: number; walkSpeed: number; pose: ClipName | null; oneShot: ClipName | null; move?: ClipName | null }): ClipName {
  if (s.oneShot) return s.oneShot;
  if (s.move) return s.move;
  if (s.pose && s.speed < 0.08) return s.pose;
  return locomotion(s.speed, s.walkSpeed);
}

/** Emote menu keys (content EmoteType.animation_key) → clips. "sit" has no clip: Sit needs a seat (tsi:sit). */
export const EMOTE_CLIPS: Record<string, ClipName> = { wave: "Wave", dance: "Dance", laugh: "Laugh", cheer: "Cheer", sad: "Sad", point: "Wave" };

export const ATTACK_CLIP: Record<WeaponKind, ClipName> = { melee: "AttackMelee", bow: "AttackBow", staff: "AttackCast", summon: "AttackCast" };
/** Which hand holds each weapon kind (clip catalogue `hand`); the bow sits in the left. */
export const WEAPON_HAND: Record<WeaponKind, "L" | "R"> = { melee: "R", bow: "L", staff: "R", summon: "R" };

export type CombatView = { alive: boolean; dodgeAge: number | null; hurt: number; attackCd: number };
/**
 * Encounter state → clip request, from the combat runtime's player fields
 * (lib/game/combat/runtime.ts). Attacks, dodges and hits are rising edges
 * against last frame's copy, so each fires its one-shot once.
 */
export function combatClip(p: CombatView, prev: CombatView, casting: boolean, kind: WeaponKind): { pose: ClipName | null; play: ClipName | null } {
  if (!p.alive) return { pose: "Defeat", play: null }; // a non-looping pose plays once and holds its last frame
  const pose = casting ? "Trace" : null;
  if (p.dodgeAge !== null && prev.dodgeAge === null) return { pose, play: "DodgeRoll" };
  if (p.attackCd > prev.attackCd + 1e-6) return { pose, play: ATTACK_CLIP[kind] };
  if (p.hurt > prev.hurt + 1e-6) return { pose, play: "Hit" };
  return { pose, play: null };
}

/** Ruling 18: seat clips are authored on a generic seat; lift the character so it lands on this furniture's seat (heights in world units). */
export function seatLift(clip: ClipName, seatHeight: number, scale: number): number {
  return seatHeight - (CLIP_BY_NAME.get(clip)?.seatHeight ?? 0) * scale;
}
