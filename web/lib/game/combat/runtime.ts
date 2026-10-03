/**
 * Live encounter state: one mutable object the frame loop writes and the HUD
 * reads (published ~10×/s, never per frame). The ability keys live with the
 * other device key maps (lib/game/movement/keys.ts).
 */
import { useSyncExternalStore } from "react";
import type { MissionState } from "./missions";
import type { Enemy, Vec } from "./sim";
import { PLAYER_BASE, WEAPONS } from "./data";
import { STARTER_WEAPONS } from "@/lib/combat/weapons";
import { ZERO_STATS, type Stat, type StatBlock } from "@/lib/combat/progression";
import type { Ability, BuffStat, Effect, Element, Status, Subclass, UnitDef } from "@/lib/combat/kits";
import type { Ctx } from "./abilities";
import type { ClassState } from "./classRuntime";
import type { Kick, MoveView } from "./moveHooks";
import type { Field } from "./primitives";

/** A shot. Weapon shots carry nothing; ability and unit shots carry what they do on impact. */
export interface ShotHit { power: number; stat?: Stat; tier?: number; pierce?: boolean; splash?: number; status?: Status; unit?: boolean; hitIds?: string[];
  /** Classes v2: hops left to the next enemy; flying home (hits nothing); sticks as the blink anchor. */
  bounce?: number; spent?: boolean; stick?: boolean;
  /** Classes v2: the impact tier, an ult's own shot, the FX registry key its hit plays. */
  impact?: ImpactTier; ult?: boolean; fx?: string;
  /** Classes v2: the FX recipe thrown along the shot as it flies, in this ramp. */
  travel?: string; ramp?: readonly [string, string, string];
  /** A sure crit (a mirrored shot); the ability whose mark rides on it (a thrown card to teleport to). */
  crit?: boolean; mark?: string;
  /** Effects where it ends, from the ability's context (a fireball bursting at the aim). */
  burst?: { effects: Effect[]; ctx: Ctx } }
/**
 * `knock`: an enemy shot's push on you (its attack's knockback). `arc`: a lobbed shot's flight time (s): it flies over
 * everything and bursts where it lands (`radius` then is the burst's), the height following the arc (mobs.ts).
 */
export interface Projectile { id: number; x: number; z: number; vx: number; vz: number; life: number; from: "player" | "enemy"; damage: number; kind: "arrow" | "bolt" | "rune" | "spore" | "card" | "bone"; radius: number; hit?: ShotHit; knock?: number; arc?: number; source?: string }
/** Summons, totems, traps and decoys (kits.ts UNITS): `source` is the ability that made it ("weapon" for the summoning charm's wisps). */
export interface Unit {
  id: number; def: UnitDef; source: string; x: number; z: number; hp: number; maxHp: number;
  /** Seconds left, or null = persists (row 50). */
  life: number | null;
  cd: number; power: number; stat: Stat;
  /** Minions that borrow an enemy model: its pose (state/t/move) for the renderer; shades borrow their corpse's. */
  body: Enemy | null;
  /** Classes v2: the FX registry key a dome or a veil re-throws while it stands. */
  fx?: string;
  /** A clone's mind (primitives.ts stepClone): its drift, strafe side, next dash and skill, its ward, facing, and the clip it copies. */
  ai?: { vx: number; vz: number; side: number; dash: number; skill: number; ward: number; facing: number; clip: string | null; mimic: number };
}
export interface Buff { stat: BuffStat; value: number; t: number; onBlock?: Ability; answered?: boolean;
  /** The ability that gave it (a v2 hold's buffs end on the release). */
  source?: string;
  /** Run on each basic attack while it lasts (Titan's shockwaves), drawn with the cast's zone effect. */
  swing?: Effect[]; swingFx?: string }
/** `ult`: an ult hit's number, in the large style (§1.6 follow-through). */
export interface Floater { id: number; x: number; y: number; z: number; text: string; kind: "hit" | "crit" | "hurt" | "info" | "ult"; age: number }
/** Something the scene plays (sound, hitstop, camera shake, a puff): pushed by the pure combat code, drained every frame. */
export type CueKind = "swing" | "hit" | "crit" | "hurt" | "defeat" | "windup" | "stagger" | "bossDefeat";
/** Impact tiers (design sheet §1.6): weapon hits, ability hits, heavy abilities (and elite kills), the ult. */
export type ImpactTier = "light" | "ability" | "heavy" | "ult";
export interface Cue { kind: CueKind; x: number; z: number; melee: boolean;
  /** A hit's impact tier (classes v2; today's hits are light, abilities "ability"); the first target of a ranged or area hit. */
  tier?: ImpactTier; first?: boolean }
/**
 * Something an effect draws, as an event every client can replay (design sheet §1.7 multiplayer-forward): who cast it,
 * the FX registry key (lib/game/fx/combat.ts), the phase, where, toward where, a seed, its impact tier and the
 * caster's 3-stop ramp. The renderer drains the list each frame.
 */
export interface FxEvent { caster: string; key: string; phase: "cast" | "travel" | "impact" | "zone"; x: number; z: number; aim: Vec; seed: number; tier: ImpactTier; ramp: readonly [string, string, string] | null; radius?: number }
export interface Blast { id: number; x: number; z: number; radius: number; color: string; age: number; life: number; arc?: number; rot?: number; length?: number }
/**
 * What the zone-1 mobs leave on the ground (mobs.ts stepHazards): a poison puddle that ticks, a pollen puff that slows,
 * a slam's shockwave running out from `r0` to `r` over its life and hitting once where its front passes.
 */
export interface Hazard { id: number; kind: "poison" | "pollen" | "wave"; x: number; z: number; r: number; r0: number; age: number; life: number; damage: number; every: number; tick: number; slow: number; knock: number; hit: boolean }
/**
 * An enemy effect for the scene to paint (components/game/combat/MobFx.tsx drains them each frame): a claw slash, a
 * spore burst, a pollen burst, rune sparks (a bolt landing, a blink out and in), a shell's glancing sparks, a crack, a
 * slam, a pounce landing. `rot` faces it; `size` scales it.
 */
export type MobFxKind = "slash" | "spores" | "pollen" | "runes" | "blink" | "glance" | "crack" | "slam" | "pounce";
export interface MobFx { kind: MobFxKind; x: number; z: number; rot: number; size: number }
/** Four equipped ability slots (row 50) plus the weapon swap; classes v2 adds key 5 and the ult (F). */
export type AbilityId = "slot1" | "slot2" | "slot3" | "slot4" | "slot5" | "ult" | "swap";
export const SLOT_IDS = ["slot1", "slot2", "slot3", "slot4"] as const;
/** Classes v2: keys 1–5, all equipped (row 291). */
export const V2_SLOT_IDS = ["slot1", "slot2", "slot3", "slot4", "slot5"] as const;
export const ABILITIES: { id: AbilityId; name: string }[] = [
  { id: "slot1", name: "Ability 1" },
  { id: "slot2", name: "Ability 2" },
  { id: "slot3", name: "Ability 3" },
  { id: "slot4", name: "Ability 4" },
  { id: "slot5", name: "Ability 5" },
  { id: "ult", name: "Ultimate" },
  { id: "swap", name: "Previous weapon" },
];
/** Energy ruling (2026-09-26): 100 max, regenerates 12/s after 1 s without spending, never while tracing. */
export const ENERGY = { max: 100, regen: 12, delay: 1 } as const;
/** The pool and its regen now: a v2 class's stat direction (max mana) raises both. */
export const energyMax = (rt: CombatRuntime) => rt.v2?.mods.energyMax ?? ENERGY.max;
export const energyRegen = (rt: CombatRuntime) => rt.v2?.mods.energyRegen ?? ENERGY.regen;

export interface CombatRuntime {
  player: {
    hp: number; maxHp: number; alive: boolean; safe: boolean; level: number; stats: StatBlock;
    energy: number; sinceSpend: number;
    /** Equipped weapon id and the owned ones the swap key cycles (starters until progression loads); `prev` the one before (R goes back to it). */
    weapon: string; prev: string | null; owned: string[]; durability: Record<string, number>; hits: Record<string, number>;
    /** `dodgeDir` is also the way the last hit pushes you, `knock` how hard (that attack's knockback). */
    attackCd: number; swing: number; dodgeAge: number | null; dodgeCd: number; dodgeDir: Vec; knock: number;
    /** `aimHold`: seconds an attack or ability keeps you facing the aim (combat polish 10, actions.ts combatFacing). */
    aim: Vec; facing: number; aimHold: number; hurt: number; downFor: number;
    /** Weapons granted (the ruins gate is open): the equipped one shows on the character's back in the village (row 140). */
    armed: boolean;
    /** Absorbs damage first, for `shieldFor` seconds. */
    shield: number; shieldFor: number;
    /** An ability dash in progress (toward the aim or away); i-frames like a dodge when `iframes`. */
    dash: { x: number; z: number; speed: number; left: number; iframes: boolean; then: ((at: Vec) => void) | null } | null;
    /** What moves the character this frame besides walking: dodge, dash, knockback (PlayerAvatar `impulse`). */
    impulse: Vec;
    /** Move speed multiplier (stats, kit, buffs, momentum) and seconds standing still (Steady Stance). */
    speed: number; still: number; last: Vec | null;
    /** Movement hooks (moveHooks.ts): what the movement sim is doing (the avatar writes it) and what abilities ask of its next step. */
    move: MoveView; kick: Kick | null;
    /** A clip an ability asks the character for (classes v2: a verb on the held weapon's grip, at its timing scale; upper = over locomotion). */
    clip: { verb: string; scale: number; upper: boolean } | null;
    /** Seconds of the ult's i-frames left (the press to 200 ms past the freeze, real time). */
    ultIframes: number;
    /** Classes v2: enemies within `r` come for you for `t` more seconds (Challenge, War Cry); damage an absorb stored (Unbreakable). */
    taunt: { t: number; r: number } | null; absorbed: number;
  };
  cooldowns: Record<AbilityId, number>;
  /** Classes v2 (the classes_v2 flag and a v2 kit; classRuntime.ts): null runs today's kits. */
  v2: ClassState | null;
  /** FX events for the renderer, oldest first, at most 64 (nobody drains them in the balance runs). */
  fx: FxEvent[];
  /** Damage dealt this run, and by ult hits (the balance harness's ult share). */
  tally: { dealt: number; ult: number };
  /** Classes v2 shared primitives on the ground and on you (primitives.ts): zones, walls, sweeps, timed stages, minion orders, marks, counters, stealth, a surf. */
  field: Field;
  /** Presses refused because the slot can't be ready in time (actions.ts runInputs): the HUD pulses the slot on each. */
  denied: Record<AbilityId, number>;
  enemies: Enemy[];
  projectiles: Projectile[]; units: Unit[]; buffs: Buff[]; floaters: Floater[]; blasts: Blast[]; cues: Cue[];
  /** Zone-1 hazards on the ground, and the enemy effects waiting to be painted (mobs.ts, MobFx.tsx). */
  hazards: Hazard[]; mobFx: MobFx[];
  /** A drawn ability being traced: today's runes root you; a v2 shape (`free`) lets you keep moving. */
  casting: { id: number; rune: string; aim: Vec; slot: number; ability: Ability; free?: boolean } | null;
  /** The subclass kit from /api/combat/progression: equipped abilities, capacity for summons, owned monster traits. */
  kit: { subclass: Subclass; capacity: number; traits: Record<string, number> } | null;
  slots: (Ability | null)[];
  /** Passive bookkeeping: last element, same-target stacks, momentum, Hot Streak procs this cooldown. */
  passive: { element: Element | null; target: string | null; stacks: number; momentum: number; momentumT: number; procs: number };
  /** A body-part transformation being shown (Transmuter). */
  transform: { name: string; t: number } | null;
  /** Kills not yet posted to /api/combat/kill. */
  killQueue: { enemy: string; key: string }[];
  mission: MissionState | null;
  idol: "temple" | "carried" | "returned";
  escort: { x: number; z: number; hp: number; waypoint: number } | null;
  wave: { index: number; active: boolean } | null;
  bossEngaged: boolean;
  /** A card in the middle of the screen (a victory and its reward, a learned trait, mastery, a mini-boss's name as it joins the fight), until `until` seconds of encounter time. */
  banner: { kind: "victory" | "trait" | "mastery" | "foe"; title: string; text: string; until: number } | null;
  seq: number;
}

/** The primitives' state, empty (primitives.ts). */
export const createField = (): Field => ({ zones: [], walls: [], sweeps: [], timers: [], order: { mode: "free", target: null }, marks: {}, counter: null, stealth: 0, reveal: 0, ambush: 0, ambushFor: 0, surf: null });
export function createRuntime(): CombatRuntime {
  return {
    player: { hp: PLAYER_BASE.maxHp, maxHp: PLAYER_BASE.maxHp, alive: true, safe: true, level: 10, stats: { ...ZERO_STATS },
      energy: ENERGY.max, sinceSpend: 99, weapon: "sword-driftwood", prev: null, owned: [...STARTER_WEAPONS],
      durability: Object.fromEntries(Object.values(WEAPONS).map(w => [w.id, w.maxDurability])),
      hits: {},
      attackCd: 0, swing: 0, dodgeAge: null, dodgeCd: 0, dodgeDir: { x: 0, z: 1 }, knock: 0,
      aim: { x: 0, z: 0 }, facing: 0, aimHold: 0, hurt: 0, downFor: 0, armed: false,
      shield: 0, shieldFor: 0, dash: null, impulse: { x: 0, z: 0 }, speed: 1, still: 0, last: null,
      move: { mode: "ground", speed: 0, sinceDash: 99, vx: 0, vz: 0 }, kick: null, clip: null, ultIframes: 0, taunt: null, absorbed: 0 },
    cooldowns: { slot1: 0, slot2: 0, slot3: 0, slot4: 0, slot5: 0, ult: 0, swap: 0 }, denied: { slot1: 0, slot2: 0, slot3: 0, slot4: 0, slot5: 0, ult: 0, swap: 0 },
    v2: null, fx: [], tally: { dealt: 0, ult: 0 }, field: createField(),
    enemies: [], projectiles: [], units: [], buffs: [], floaters: [], blasts: [], cues: [], hazards: [], mobFx: [],
    casting: null, kit: null, slots: [null, null, null, null],
    passive: { element: null, target: null, stacks: 0, momentum: 0, momentumT: 0, procs: 0 }, transform: null,
    killQueue: [], mission: null, idol: "temple", escort: null, wave: null, bossEngaged: false, banner: null, seq: 1,
  };
}

/**
 * The member's weapons from /api/combat/progression: every owned one with a look joins the swap cycle (and the tool
 * wheel), with its durability; the one equipped in the database is the default in hand (specs/game-ui.md §3).
 */
export function setOwnedWeapons(rt: CombatRuntime, owned: { weapon_key: string; durability: number; equipped?: boolean }[]) {
  const usable = owned.filter(w => WEAPONS[w.weapon_key]);
  for (const w of usable) rt.player.durability[w.weapon_key] = w.durability;
  rt.player.owned = [...new Set([...STARTER_WEAPONS, ...usable.map(w => w.weapon_key)])];
  const equipped = usable.find(w => w.equipped)?.weapon_key;
  if (equipped) rt.player.weapon = equipped;
}
/** Take a weapon in hand (the tool wheel, R): the one held before becomes `prev`. False when it's unknown, not yours or already in hand. */
export function setWeapon(rt: CombatRuntime, key: string): boolean {
  const p = rt.player;
  if (!WEAPONS[key] || !p.owned.includes(key) || key === p.weapon) return false;
  p.prev = p.weapon; p.weapon = key; p.attackCd = Math.max(p.attackCd, 0.2);
  return true;
}

// ── HUD subscription ────────────────────────────────────────────
/**
 * `freeze` (dev, via window.__combat): the encounter clock stops so a telegraph can be held for a screenshot.
 * `hitstop`: seconds the encounter and your avatar hold still after a melee hit, a crit or a hit taken (the ruins scene sets it).
 */
export const combat = { rt: createRuntime(), freeze: false, hitstop: 0 };
let version = 0;
const listeners = new Set<() => void>();
export function publishCombat() { version++; for (const l of listeners) l(); }
// Dev (screenshots): the runtime and a publish, in the village as well as the ruins.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") Object.assign(window, { __combat: combat, __publishCombat: publishCombat });
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export function useCombatVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => 0);
}
/** Re-render only when `pick` (a primitive read from the runtime) changes, not on every ~10/s publish. */
export function useCombatValue<T extends string | number | boolean>(pick: () => T): T {
  return useSyncExternalStore(subscribe, pick, pick);
}

// ── Mission board mutations (kept here so components never write the runtime directly) ──
export function setMission(mission: MissionState | null) { combat.rt.mission = mission; if (mission) combat.rt.idol = "temple"; publishCombat(); }
export function attachProgressId(missionId: string, progressId: string) {
  const m = combat.rt.mission;
  if (m?.def.id === missionId) { combat.rt.mission = { ...m, progressId }; publishCombat(); }
}
export function takeMissionQueue(): MissionState["queue"] {
  const m = combat.rt.mission;
  if (!m) return [];
  combat.rt.mission = { ...m, queue: [] };
  return m.queue;
}
