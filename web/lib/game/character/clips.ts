/**
 * Animation state machine (rows 111, 139, 140): which clip a character plays.
 * Priority: a one-shot in progress (emote, forage, attack...) > a held pose
 * (sit, study, sleep, fish hold, trace, defeat) > locomotion from speed.
 * Pure so it can be tested; Character.tsx drives the mixer with it.
 */
import type { Object3D } from "three";
import { CLIP_BY_NAME, VERB_BY_NAME } from "./look";
import { MOVE_TUNING } from "@/lib/game/movement/sim";
import type { WeaponKind } from "@/lib/game/combat/contract";
import type { FaceOverride } from "./face";

type VillageClip = "Idle" | "Walk" | "Run" | "Sit" | "Study" | "Sleep" | "Fish" | "FishHold" | "Forage" | "Dig" | "Net"
  | "Wave" | "Cheer" | "Laugh" | "Sad" | "Dance" | "AttackMelee" | "AttackBow" | "AttackCast" | "DodgeRoll" | "Hit" | "Defeat" | "Trace" | "Stretch"
  | "Jump" | "Air" | "Fall" | "Land" | "LandHeavy" | "Roll" | "Mantle" | "Dash" | "Skid" | "Glide"
  | "CrouchIdle" | "CrouchWalk" | "Slide" | "SlideIn" | "SlideInDash" | "SlideUp" | "SlideJump" | "SlideStand" | "SlideBonk"
  // Residents' idles (specs/polish/living-village.md): a look round, a standing stretch, talking with someone.
  | "LookAround" | "StretchUp" | "Chat"
  // Holding things (specs/game-ui.md §2): arm poses laid over locomotion (Character.tsx), and eating a held snack.
  | "HoldRod" | "HoldTool" | "HoldFront" | "Eat";

/**
 * The verb library (classes v2, design sheet §1.8): sixteen shared verbs, each authored once per grip family in
 * build_clips.py (`-- verbs`), shipped in their own GLB (look.ts VERBS_URL) that only the ruins load. An ability names
 * a verb; the grip comes from the weapon in hand (`gripFor`), so `verbClip(verb, gripFor(type))` is the clip to play.
 */
export const VERBS = ["CastForward", "CastUp", "Slam", "Thrust", "Spin", "LeapStrike", "Throw", "Summon", "Channel", "Guard", "Kick", "Sweep",
  "Plant", "DrawShot", "QuickShot", "Backstep"] as const;
export const GRIPS = ["OneHand", "Staff", "Bow", "Pistol", "Fists", "Book"] as const;
export type Verb = (typeof VERBS)[number];
export type Grip = (typeof GRIPS)[number];
export type VerbClip = `${Verb}_${Grip}`;
/** Each grip's weapon held over locomotion (arms only, like HoldTool): `motion.hold`. */
export type HoldIdleClip = `HoldIdle_${Grip}`;
/** Per-subclass clips the family waves add (build_clips.py `@unique`): the ult and up to 3 unique ability clips. */
export type UniqueClip = `Ult_${string}` | `Unique_${string}`;
export type ClipName = VillageClip | VerbClip | HoldIdleClip | UniqueClip;

/** The grip family of a weapon type (lib/combat/weapons.ts WeaponType; signature types fall back to one hand). */
const GRIP_OF: Record<string, Grip> = { sword: "OneHand", shield: "OneHand", bow: "Bow", revolver: "Pistol", staff: "Staff", tome: "Book", fists: "Fists", totem: "Staff",
  // Classes v2 signature types (the Arcane wave): the prism staff, the deck in one hand, the bone tome, the charm on bare fists.
  "prism-staff": "Staff", "trick-deck": "OneHand", "bone-tome": "Book", "tooth-charm": "Fists",
  // The Vanguard wave's signature types: sword and board, the two-handed hammer, wrapped fists, twin blades held like fists.
  aegis: "OneHand", warhammer: "Staff", handwraps: "Fists", tanto: "Fists" };
export const gripFor = (weaponType: string): Grip => GRIP_OF[weaponType] ?? "OneHand";
export const verbClip = (verb: Verb, grip: Grip): VerbClip => `${verb}_${grip}`;
export const holdIdle = (grip: Grip): HoldIdleClip => `HoldIdle_${grip}`;
/** The verb library's entry for a clip (length, impact phase, upper-body, hand), or null for a village clip. */
export const verbInfo = (name: string) => VERB_BY_NAME.get(name) ?? null;
/** The socket a grip holds its weapon in: the bow and the pistol sit in the left hand, the book is held in the left while the right casts. */
export const GRIP_HAND: Record<Grip, "L" | "R"> = { OneHand: "R", Staff: "R", Bow: "L", Pistol: "L", Fists: "R", Book: "L" };
const isVerb = (name: string): name is VerbClip => VERB_BY_NAME.has(name) && !name.startsWith("HoldIdle_");

/**
 * Overlay layers (Character.tsx): which bone tracks a layer drives. "upper": the spine up (spine, neck, head, both
 * arms), a cast or shot over a run or a slide; "arms": both arms (a two-handed hold); "rightArm": a tool's hold.
 */
export type Layer = "upper" | "arms" | "rightArm";
const LAYER_BONES: Record<Layer, RegExp> = {
  upper: /^mixamorig(Spine|Spine1|Spine2|Neck|Head|(Left|Right)(Shoulder|Arm|ForeArm|Hand))\.quaternion$/,
  arms: /^mixamorig(Left|Right)(Shoulder|Arm|ForeArm|Hand)\.quaternion$/,
  rightArm: /^mixamorigRight(Shoulder|Arm|ForeArm|Hand)\.quaternion$/,
};
export const layerTrack = (layer: Layer, track: string) => LAYER_BONES[layer].test(track);
/** The arm hold a clip lays: a tool's is the right arm; holding in front and the grips' hold idles take both. */
export const holdLayer = (clip: ClipName): Layer => (clip === "HoldFront" || clip.startsWith("HoldIdle_") ? "arms" : "rightArm");
/** An upper-body one-shot's weight at `t` of `length` s: in over `fadeIn`, out over the last `fadeOut`. */
export function layerWeight(t: number, length: number, fadeIn = 0.05, fadeOut = 0.1): number {
  if (t < 0 || t >= length) return 0;
  return Math.min(1, t / fadeIn, (length - t) / fadeOut);
}
/** Movement clips (lib/game/movement): quick crossfades so hops and landings read on time. */
export const SNAPPY_CLIPS = new Set<ClipName>(["DodgeRoll", "Hit", "Jump", "Air", "Fall", "Land", "LandHeavy", "Roll", "Mantle", "Dash", "Skid", "Glide",
  "Slide", "SlideIn", "SlideInDash", "SlideUp", "SlideJump", "SlideStand", "SlideBonk"]);

/**
 * The transition table (specs/movement-feel.md §5): crossfade seconds for every pair of clips. Each clip belongs to a
 * family and `FAMILY_FADE` gives every family pair its time; `FADES` overrides the pairs that matter one by one. A
 * landing cuts into a fall in a few hundredths (it interrupts it cleanly); run, slide, slide-jump, air and land-slide
 * hand over as fast; sitting down, lying down and getting up ease; a hit is immediate.
 */
type Family = "loco" | "air" | "land" | "move" | "seat" | "act" | "combat" | "ability";
const FAMILY: Record<VillageClip, Family> = {
  Idle: "loco", Walk: "loco", Run: "loco", CrouchIdle: "loco", CrouchWalk: "loco",
  Jump: "air", Air: "air", Fall: "air", Glide: "air", SlideJump: "air",
  Land: "land", LandHeavy: "land", Roll: "land", Mantle: "land",
  Dash: "move", Skid: "move", DodgeRoll: "move", Slide: "move", SlideIn: "move", SlideInDash: "move", SlideUp: "move", SlideStand: "move", SlideBonk: "move",
  Sit: "seat", Study: "seat", Stretch: "seat", Sleep: "seat",
  Fish: "act", FishHold: "act", Forage: "act", Dig: "act", Net: "act", Wave: "act", Cheer: "act", Laugh: "act", Sad: "act", Dance: "act", Trace: "act",
  LookAround: "act", StretchUp: "act", Chat: "act", Eat: "act",
  HoldRod: "loco", HoldTool: "loco", HoldFront: "loco",
  AttackMelee: "combat", AttackBow: "combat", AttackCast: "combat", Hit: "combat", Defeat: "combat",
};
/**
 * From a family (row) into a family (column). The verbs are "ability" (design sheet §1.8's combat row): into one from
 * anything in 0.05 s, out of one to locomotion in 0.1 s; a hit stays immediate (`crossfade`). The legacy attack clips
 * keep their "combat" numbers.
 */
const FAMILY_FADE: Readonly<Record<Family, Readonly<Record<Family, number>>>> = {
  loco: { loco: 0.16, air: 0.05, land: 0.05, move: 0.05, seat: 0.25, act: 0.15, combat: 0.08, ability: 0.05 },
  air: { loco: 0.1, air: 0.06, land: 0.04, move: 0.05, seat: 0.25, act: 0.15, combat: 0.08, ability: 0.05 },
  land: { loco: 0.12, air: 0.05, land: 0.06, move: 0.05, seat: 0.25, act: 0.15, combat: 0.08, ability: 0.05 },
  move: { loco: 0.1, air: 0.04, land: 0.05, move: 0.05, seat: 0.25, act: 0.15, combat: 0.08, ability: 0.05 },
  seat: { loco: 0.22, air: 0.1, land: 0.1, move: 0.08, seat: 0.3, act: 0.2, combat: 0.1, ability: 0.05 },
  act: { loco: 0.18, air: 0.08, land: 0.08, move: 0.06, seat: 0.25, act: 0.16, combat: 0.08, ability: 0.05 },
  combat: { loco: 0.14, air: 0.06, land: 0.06, move: 0.05, seat: 0.25, act: 0.15, combat: 0.06, ability: 0.05 },
  ability: { loco: 0.1, air: 0.06, land: 0.06, move: 0.05, seat: 0.25, act: 0.15, combat: 0.06, ability: 0.05 },
};
const familyOf = (clip: ClipName): Family => (isVerb(clip) ? "ability" : clip.startsWith("HoldIdle_") ? "loco" : FAMILY[clip as VillageClip]);
const FADES: Readonly<Record<string, number>> = {
  // Locomotion among itself: the walk and the run cross in step (`matchPhase`), the crouch eases.
  "Idle>Walk": 0.2, "Walk>Idle": 0.2, "Walk>Run": 0.15, "Run>Walk": 0.15, "Idle>Run": 0.12, "Run>Idle": 0.16,
  "Fall>Land": 0.04, "Fall>LandHeavy": 0.04, "Fall>Roll": 0.04, "Air>Land": 0.04, "Air>LandHeavy": 0.04, "Air>Roll": 0.04, "Air>Fall": 0.12, "Fall>Air": 0.08,
  "Jump>Air": 0.03, "Mantle>Idle": 0.1, "Mantle>Walk": 0.08, "Mantle>Run": 0.08, "Skid>Run": 0.06, "Skid>Walk": 0.08, "Dash>Idle": 0.14,
  "Glide>Land": 0.08, "Glide>Fall": 0.1, "Air>Glide": 0.08, "Fall>Glide": 0.08,
  "Defeat>Idle": 0.3, "Sleep>Idle": 0.3, "Idle>Sleep": 0.3,
  "Run>SlideIn": 0.05, "Walk>SlideIn": 0.06, "Dash>SlideInDash": 0.03, "Air>SlideInDash": 0.05, "Fall>SlideInDash": 0.06, "Jump>SlideInDash": 0.05,
  "SlideIn>Slide": 0.04, "SlideInDash>Slide": 0.04, "Air>Slide": 0.08, "Slide>Dash": 0.04,
  "Slide>SlideJump": 0.03, "SlideIn>SlideJump": 0.03, "SlideInDash>SlideJump": 0.03, "SlideJump>Air": 0.03,
  "Slide>SlideUp": 0.04, "SlideUp>Run": 0.08, "SlideUp>Walk": 0.12, "SlideUp>Idle": 0.14,
  "Slide>SlideStand": 0.05, "SlideStand>CrouchIdle": 0.06, "SlideStand>CrouchWalk": 0.1,
  "Slide>SlideBonk": 0.03, "SlideBonk>Idle": 0.12, "SlideBonk>CrouchIdle": 0.12, "SlideBonk>Walk": 0.14,
  "Idle>CrouchIdle": 0.18, "CrouchIdle>Idle": 0.18, "Walk>CrouchWalk": 0.14, "CrouchWalk>Walk": 0.14, "Run>CrouchWalk": 0.12,
  "CrouchIdle>CrouchWalk": 0.12, "CrouchWalk>CrouchIdle": 0.15, "Idle>CrouchWalk": 0.15, "CrouchWalk>Idle": 0.15, "Walk>CrouchIdle": 0.15, "CrouchIdle>Walk": 0.15,
};
export function crossfade(from: ClipName | null, to: ClipName): number {
  if (!from) return 0.16;
  if (to === "Hit") return 0.04; // a hit lands now
  return FADES[`${from}>${to}`] ?? FAMILY_FADE[familyOf(from)][familyOf(to)];
}

/** Locomotion loops that cross into each other in step: the next one starts with the same foot coming down. */
const STEPPED = new Set<ClipName>(["Walk", "Run", "CrouchWalk"]);
/**
 * Stride matching across loops: where `to` should start when `from` was at `phase`, so the same foot is at the same
 * point of its step (both loops' measured contacts: left foot down, half a cycle later the right). Null: start at 0.
 */
export function matchPhase(from: ClipName | null, phase: number, to: ClipName): number | null {
  if (!from || from === to || !STEPPED.has(from) || !STEPPED.has(to)) return null;
  const a = CLIP_BY_NAME.get(from)?.contacts, b = CLIP_BY_NAME.get(to)?.contacts;
  if (!a?.length || !b?.length) return null;
  return (((b[0] + phase - a[0]) % 1) + 1) % 1;
}

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
  /** An upper-body one-shot (a cast or a shot over a run, a slide or a jump): the spine up plays it over whatever the body plays; consumed like `play`. */
  upper?: ClipName | null;
  /** Timing scale for the next one-shot (`play` or `upper`), consumed with it: an ability speeds a verb up or slows it down. */
  playRate?: number;
  /** An arm hold laid over locomotion (a grip's HoldIdle_*), while set; a held tool's own hold wins. */
  hold?: ClipName | null;
  /** The weapon in hand, written by the character (null when none): its grip at the model origin, its tip along +Y (ribbon trails). */
  weaponModel?: Object3D | null;
  /** Ask for an afterimage of this frame's pose (a dash); the character clears it. */
  ghost?: boolean;
  /** This character leaves afterimages (the player): they are made and compiled up front, so the first dash never hitches. */
  afterimages?: boolean }

export const isLoop = (clip: ClipName) => (CLIP_BY_NAME.get(clip) ?? VERB_BY_NAME.get(clip))?.loop ?? true;

/**
 * Idle below a crawl, Run above 1.25x walking pace (sprint is 1.85x). Already running, it keeps the run down to 1.15x,
 * so a speed hovering at the line never flickers between the two.
 */
export function locomotion(speed: number, walkSpeed: number, current?: ClipName | null): "Idle" | "Walk" | "Run" {
  return speed < 0.08 ? "Idle" : speed > walkSpeed * (current === "Run" ? 1.15 : 1.25) ? "Run" : "Walk";
}
/**
 * Playback rate: each loop's cadence follows ground speed in proportion, from a slow amble up (the walk no longer
 * treads in place below a third of its pace). The feet still slide at full speed: a 1.36u character walking 7.4u/s
 * would need about 23 steps a second to plant them (specs/movement-feel.md, stride matching).
 */
export function tempo(clip: ClipName, speed: number, walkSpeed: number): number {
  if (clip === "Walk") return Math.min(1.6, Math.max(0.15, speed / walkSpeed));
  if (clip === "CrouchWalk") return Math.min(1.6, Math.max(0.4, speed / (walkSpeed * (MOVE_TUNING.sneakSpeed / MOVE_TUNING.walkSpeed))));
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
export function resolveClip(s: { speed: number; walkSpeed: number; pose: ClipName | null; oneShot: ClipName | null; move?: ClipName | null; current?: ClipName | null }): ClipName {
  if (s.oneShot) return s.oneShot;
  if (s.move) return s.move;
  if (s.pose && s.speed < 0.08) return s.pose;
  return locomotion(s.speed, s.walkSpeed, s.current);
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
