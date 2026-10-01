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
import type { Ability, BuffStat, Element, Status, Subclass, UnitDef } from "@/lib/combat/kits";

/** A shot. Weapon shots carry nothing; ability and unit shots carry what they do on impact. */
export interface ShotHit { power: number; stat?: Stat; tier?: number; pierce?: boolean; splash?: number; status?: Status; unit?: boolean; hitIds?: string[] }
/** `knock`: an enemy shot's push on you (its attack's knockback). */
export interface Projectile { id: number; x: number; z: number; vx: number; vz: number; life: number; from: "player" | "enemy"; damage: number; kind: "arrow" | "bolt" | "spit"; radius: number; hit?: ShotHit; knock?: number }
/** Summons, totems, traps and decoys (kits.ts UNITS): `source` is the ability that made it ("weapon" for the summoning charm's wisps). */
export interface Unit {
  id: number; def: UnitDef; source: string; x: number; z: number; hp: number; maxHp: number;
  /** Seconds left, or null = persists (row 50). */
  life: number | null;
  cd: number; power: number; stat: Stat;
  /** Minions that borrow an enemy model: its pose (state/t/move) for the renderer; shades borrow their corpse's. */
  body: Enemy | null;
}
export interface Buff { stat: BuffStat; value: number; t: number; onBlock?: Ability; answered?: boolean }
export interface Floater { id: number; x: number; y: number; z: number; text: string; kind: "hit" | "crit" | "hurt" | "info"; age: number }
/** Something the scene plays (sound, hitstop, camera shake, a puff): pushed by the pure combat code, drained every frame. */
export type CueKind = "swing" | "hit" | "crit" | "hurt" | "defeat" | "windup" | "stagger" | "bossDefeat";
export interface Cue { kind: CueKind; x: number; z: number; melee: boolean }
export interface Blast { id: number; x: number; z: number; radius: number; color: string; age: number; life: number; arc?: number; rot?: number; length?: number }
/** Four equipped ability slots (row 50) plus the weapon swap. */
export type AbilityId = "slot1" | "slot2" | "slot3" | "slot4" | "swap";
export const SLOT_IDS = ["slot1", "slot2", "slot3", "slot4"] as const;
export const ABILITIES: { id: AbilityId; name: string }[] = [
  { id: "slot1", name: "Ability 1" },
  { id: "slot2", name: "Ability 2" },
  { id: "slot3", name: "Ability 3" },
  { id: "slot4", name: "Ability 4" },
  { id: "swap", name: "Swap weapon" },
];
/** Energy ruling (2026-09-26): 100 max, regenerates 12/s after 1 s without spending, never while tracing. */
export const ENERGY = { max: 100, regen: 12, delay: 1 } as const;

export interface CombatRuntime {
  player: {
    hp: number; maxHp: number; alive: boolean; safe: boolean; level: number; stats: StatBlock;
    energy: number; sinceSpend: number;
    /** Equipped weapon id and the owned ones the swap key cycles (starters until progression loads). */
    weapon: string; owned: string[]; durability: Record<string, number>; hits: Record<string, number>;
    /** `dodgeDir` is also the way the last hit pushes you, `knock` how hard (that attack's knockback). */
    attackCd: number; swing: number; dodgeAge: number | null; dodgeCd: number; dodgeDir: Vec; knock: number;
    aim: Vec; facing: number; hurt: number; downFor: number;
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
  };
  cooldowns: Record<AbilityId, number>;
  /** Presses refused because the slot can't be ready in time (actions.ts runInputs): the HUD pulses the slot on each. */
  denied: Record<AbilityId, number>;
  enemies: Enemy[];
  projectiles: Projectile[]; units: Unit[]; buffs: Buff[]; floaters: Floater[]; blasts: Blast[]; cues: Cue[];
  casting: { id: number; rune: "spark" | "binding"; aim: Vec; slot: number; ability: Ability } | null;
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
  /** A card in the middle of the screen (boss victory reward), until `until` seconds of encounter time. */
  banner: { text: string; until: number } | null;
  seq: number;
}

export function createRuntime(): CombatRuntime {
  return {
    player: { hp: PLAYER_BASE.maxHp, maxHp: PLAYER_BASE.maxHp, alive: true, safe: true, level: 10, stats: { ...ZERO_STATS },
      energy: ENERGY.max, sinceSpend: 99, weapon: "sword-driftwood", owned: [...STARTER_WEAPONS],
      durability: Object.fromEntries(Object.values(WEAPONS).map(w => [w.id, w.maxDurability])),
      hits: {},
      attackCd: 0, swing: 0, dodgeAge: null, dodgeCd: 0, dodgeDir: { x: 0, z: 1 }, knock: 0,
      aim: { x: 0, z: 0 }, facing: 0, hurt: 0, downFor: 0, armed: false,
      shield: 0, shieldFor: 0, dash: null, impulse: { x: 0, z: 0 }, speed: 1, still: 0, last: null },
    cooldowns: { slot1: 0, slot2: 0, slot3: 0, slot4: 0, swap: 0 }, denied: { slot1: 0, slot2: 0, slot3: 0, slot4: 0, swap: 0 },
    enemies: [], projectiles: [], units: [], buffs: [], floaters: [], blasts: [], cues: [],
    casting: null, kit: null, slots: [null, null, null, null],
    passive: { element: null, target: null, stacks: 0, momentum: 0, momentumT: 0, procs: 0 }, transform: null,
    killQueue: [], mission: null, idol: "temple", escort: null, wave: null, bossEngaged: false, banner: null, seq: 1,
  };
}

/** The member's weapons from /api/combat/progression: every owned one with a look joins the swap cycle, with its durability. */
export function setOwnedWeapons(rt: CombatRuntime, owned: { weapon_key: string; durability: number }[]) {
  const usable = owned.filter(w => WEAPONS[w.weapon_key]);
  for (const w of usable) rt.player.durability[w.weapon_key] = w.durability;
  rt.player.owned = [...new Set([...STARTER_WEAPONS, ...usable.map(w => w.weapon_key)])];
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
export function useCombatVersion(): number {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => version, () => 0);
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
