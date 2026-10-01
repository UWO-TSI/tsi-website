/**
 * Animation state machine (rows 111, 139, 140): which clip a character plays.
 * Priority: a one-shot in progress (emote, forage, attack...) > a held pose
 * (sit, study, sleep, fish hold, trace, defeat) > locomotion from speed.
 * Pure so it can be tested; Character.tsx drives the mixer with it.
 */
import { CLIP_BY_NAME } from "./look";
import type { WeaponKind } from "@/lib/game/combat/contract";
import type { FaceOverride } from "./face";

export type ClipName = "Idle" | "Walk" | "Run" | "Sit" | "Study" | "Sleep" | "Fish" | "FishHold" | "Forage" | "Dig" | "Net"
  | "Wave" | "Cheer" | "Laugh" | "Sad" | "Dance" | "AttackMelee" | "AttackBow" | "AttackCast" | "DodgeRoll" | "Hit" | "Defeat" | "Trace" | "Stretch"
  | "Jump" | "Air" | "Fall" | "Land" | "LandHeavy" | "Roll" | "Mantle" | "Dash" | "Skid" | "Glide";
/** Movement clips (lib/game/movement): quick crossfades so hops and landings read on time. */
export const SNAPPY_CLIPS = new Set<ClipName>(["DodgeRoll", "Hit", "Jump", "Air", "Fall", "Land", "LandHeavy", "Roll", "Mantle", "Dash", "Skid", "Glide"]);

/**
 * What the world asks of a character each frame. `speed` is ground speed in
 * world units/s; `pose` is a held clip (null = free); `play` is a one-shot
 * request that the character consumes (sets back to null) when it starts;
 * `move` is a movement state (in the air, skidding) that holds over locomotion.
 */
export interface CharacterMotion { speed: number; yaw: number; lift: number; pose?: ClipName | null; play?: ClipName | null; move?: ClipName | null;
  /** Animation clock rate (slow motion in /lab/move; 1 when unset). */
  rate?: number;
  /** End the running one-shot now (a landing cuts a short hop's Jump); the character clears it. */
  stop?: boolean;
  /** Seconds of talking left (a chat or speech bubble): the mouth moves until it runs out; the character counts it down. */
  talk?: number;
  /** A forced face (dialogue portraits, the avatar bench): expression, eye frame or mouth cell. */
  face?: FaceOverride | null;
  /** The leaf glider in the right hand (specs/glider.md): its size, 0 furled (hidden) to 1 open, a little over 1 as it pops open. */
  leaf?: number;
  /** The Air clip's pose while `move` is "Air": 0 take-off, 0.5 the apex tuck, 1 reaching for the ground (airPhase). */
  air?: number;
  /** Foot contacts so far (the character counts them up as Walk or Run passes each foot's contact) and the last foot, 0 left 1 right. */
  steps?: number; foot?: number;
  /** Ask for an afterimage of this frame's pose (a dash); the character clears it. */
  ghost?: boolean;
  /** This character leaves afterimages (the player): they are made and compiled up front, so the first dash never hitches. */
  afterimages?: boolean }

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

/**
 * The contact a loop's playhead passed going from phase `from` to `to` this frame (wrapping past 1), as its index in
 * `contacts`, or -1. Two in one frame (a long hitch) report the later one.
 */
export function contactCrossed(contacts: readonly number[] | undefined, from: number, to: number): number {
  if (!contacts || from === to) return -1;
  let hit = -1, best = -1;
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i], past = to >= from ? c > from && c <= to : c > from || c <= to;
    // How far past it the playhead is now: the smallest is the latest crossing.
    const ago = past ? (to - c + 1) % 1 : -1;
    if (past && (best < 0 || ago < best)) { best = ago; hit = i; }
  }
  return hit;
}

/**
 * The Air pose for a vertical speed (specs/movement-feel.md): rising from the take-off (0) to the apex tuck (0.5) as
 * `vy` falls from the take-off speed `vy0` to 0, then on to reaching for the ground (1) as the fall reaches `vy0`.
 * Walking off an edge starts past the tuck (`jumped` false), at the early fall.
 */
export function airPhase(vy: number, vy0: number, jumped: boolean): number {
  const v = Math.max(0.1, vy0);
  if (vy > 0) return jumped ? 0.5 * (1 - Math.min(1, vy / v)) : 0.75;
  return Math.min(1, (jumped ? 0.5 : 0.75) + (jumped ? 0.5 : 0.25) * Math.min(1, -vy / v));
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
