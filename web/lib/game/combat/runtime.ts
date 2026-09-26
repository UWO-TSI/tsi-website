/**
 * Live encounter state: one mutable object the frame loop writes and the HUD
 * reads (published ~10×/s, never per frame). Also the ability keys (1–4,
 * remappable on this device until the account settings carry them).
 */
import { useSyncExternalStore } from "react";
import type { MissionState } from "./missions";
import type { Enemy, Vec } from "./sim";
import { PLAYER_BASE, WEAPONS, WEAPON_ORDER } from "./data";
import { ZERO_STATS, type StatBlock } from "@/lib/combat/progression";
import type { Ability } from "@/lib/combat/kits";

export type WeaponId = (typeof WEAPON_ORDER)[number];
export interface Projectile { id: number; x: number; z: number; vx: number; vz: number; life: number; from: "player" | "enemy"; damage: number; kind: "arrow" | "bolt" | "spit"; radius: number }
export interface Minion { id: number; x: number; z: number; life: number; cooldown: number }
export interface Floater { id: number; x: number; y: number; z: number; text: string; kind: "hit" | "crit" | "hurt" | "info"; age: number }
export interface Blast { id: number; x: number; z: number; radius: number; color: string; age: number; life: number }
export type AbilityId = "spark" | "binding" | "swap" | "signature";
export const ABILITIES: { id: AbilityId; name: string }[] = [
  { id: "spark", name: "Spark (rune)" },
  { id: "binding", name: "Binding (rune)" },
  { id: "swap", name: "Swap weapon" },
  { id: "signature", name: "Signature" },
];
/** Energy ruling (2026-09-26): 100 max, regenerates 12/s after 1 s without spending, never while tracing. */
export const ENERGY = { max: 100, regen: 12, delay: 1 } as const;

export interface CombatRuntime {
  player: {
    hp: number; maxHp: number; alive: boolean; safe: boolean; level: number; stats: StatBlock;
    energy: number; sinceSpend: number;
    weapon: WeaponId; durability: Record<WeaponId, number>; hits: Record<WeaponId, number>;
    attackCd: number; swing: number; dodgeAge: number | null; dodgeCd: number; dodgeDir: Vec;
    aim: Vec; facing: number; hurt: number; downFor: number;
  };
  cooldowns: Record<AbilityId, number>;
  enemies: Enemy[];
  projectiles: Projectile[]; minions: Minion[]; floaters: Floater[]; blasts: Blast[];
  casting: { id: number; rune: "spark" | "binding"; aim: Vec; potencyScale: number } | null;
  /** Subclass signature from /api/combat/progression (kits data). */
  signature: Ability | null;
  /** Kills not yet posted to /api/combat/kill. */
  killQueue: { enemy: string; key: string }[];
  mission: MissionState | null;
  idol: "temple" | "carried" | "returned";
  escort: { x: number; z: number; hp: number; waypoint: number } | null;
  wave: { index: number; active: boolean } | null;
  bossEngaged: boolean;
  seq: number;
}

export function createRuntime(): CombatRuntime {
  return {
    player: { hp: PLAYER_BASE.maxHp, maxHp: PLAYER_BASE.maxHp, alive: true, safe: true, level: 10, stats: { ...ZERO_STATS },
      energy: ENERGY.max, sinceSpend: 99, weapon: "sword-driftwood",
      durability: Object.fromEntries(WEAPON_ORDER.map(id => [id, WEAPONS[id].maxDurability])) as Record<WeaponId, number>,
      hits: Object.fromEntries(WEAPON_ORDER.map(id => [id, 0])) as Record<WeaponId, number>,
      attackCd: 0, swing: 0, dodgeAge: null, dodgeCd: 0, dodgeDir: { x: 0, z: 1 },
      aim: { x: 0, z: 0 }, facing: 0, hurt: 0, downFor: 0 },
    cooldowns: { spark: 0, binding: 0, swap: 0, signature: 0 },
    enemies: [], projectiles: [], minions: [], floaters: [], blasts: [],
    casting: null, signature: null, killQueue: [], mission: null, idol: "temple", escort: null, wave: null, bossEngaged: false, seq: 1,
  };
}

// ── HUD subscription ────────────────────────────────────────────
export const combat = { rt: createRuntime() };
let version = 0;
const listeners = new Set<() => void>();
export function publishCombat() { version++; for (const l of listeners) l(); }
export function useCombatVersion(): number {
  return useSyncExternalStore(l => { listeners.add(l); return () => { listeners.delete(l); }; }, () => version, () => 0);
}

// ── Ability keys (1–4, remappable) ──────────────────────────────
const KEYS_KEY = "tsi.combatKeys.v1";
export const DEFAULT_ABILITY_KEYS: Record<AbilityId, string> = { spark: "1", binding: "2", swap: "3", signature: "4" };
const RESERVED = new Set(["w", "a", "s", "d", " ", "e", "escape", "shift", "tab", "c", "z", "m", "j", "b", "i"]);
export function readAbilityKeys(): Record<AbilityId, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS_KEY) ?? "null");
    if (raw && typeof raw === "object") {
      const out = { ...DEFAULT_ABILITY_KEYS };
      for (const a of Object.keys(out) as AbilityId[]) if (typeof raw[a] === "string" && raw[a].length === 1 && !RESERVED.has(raw[a])) out[a] = raw[a];
      if (new Set(Object.values(out)).size === 4) return out;
    }
  } catch { /* defaults */ }
  return { ...DEFAULT_ABILITY_KEYS };
}
/** Rebind an ability; taking another ability's key swaps them. Movement, dodge and menu keys are refused. */
export function remapAbility(keys: Record<AbilityId, string>, id: AbilityId, raw: string): { ok: true; keys: Record<AbilityId, string> } | { ok: false; error: string } {
  const k = raw.toLowerCase();
  if (k.length !== 1 || RESERVED.has(k)) return { ok: false, error: `${raw === " " ? "Space" : raw.toUpperCase()} is already used.` };
  const other = (Object.keys(keys) as AbilityId[]).find(a => a !== id && keys[a] === k);
  const next = { ...keys, [id]: k };
  if (other) next[other] = keys[id];
  try { localStorage.setItem(KEYS_KEY, JSON.stringify(next)); } catch { /* session only */ }
  return { ok: true, keys: next };
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
