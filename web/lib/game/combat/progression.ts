/**
 * Island side of /api/combat/*: the gate check and progression (rows 179,
 * 207), kill XP, weapon wear, and mission start/progress/complete. Each call
 * is idempotent on the server; failures leave the local encounter playable.
 */
import type { CombatProgression } from "./contract";
import type { Ability } from "@/lib/combat/kits";
import type { StatBlock } from "@/lib/combat/progression";
import type { MissionEvent } from "@/lib/combat/missions";
import type { BossReward } from "@/lib/combat/content";
import { installCombatDemo } from "./demo";

export interface IslandProgression extends CombatProgression { stats: StatBlock | null; maxHp: number | null; signature: Ability | null; weapons: { weapon_key: string; durability: number }[] }

async function call<T>(path: string, key: string, body?: unknown): Promise<{ ok: true; data: T; raw: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  installCombatDemo();
  try {
    const res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) return { ok: false, status: res.status, error: json?.error ?? (res.status === 401 ? "Sign in first." : "The ruins are quiet right now.") };
    return { ok: true, data: json[key] as T, raw: json };
  } catch { return { ok: false, status: 0, error: "The ruins couldn't be reached." }; }
}
const key = (prefix: string) => `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

export async function combatProgression(): Promise<IslandProgression> {
  const r = await call<{ level: number; stats: StatBlock; derived?: { max_hp?: number }; family: string | null; subclass: { key: string; signature: Ability } | null; weapons: { weapon_key: string; durability: number }[] }>("/api/combat/progression", "progression");
  if (!r.ok) return { level: 1, family: null, subclass: null, gateOpen: false, reason: r.status === 401 ? "Sealed. Sign in to enter the ruins." : r.error, stats: null, maxHp: null, signature: null, weapons: [] };
  const gate = r.raw.gate as CombatProgression;
  return { ...gate, stats: r.data.stats, maxHp: r.data.derived?.max_hp ?? null, signature: r.data.subclass?.signature ?? null, weapons: r.data.weapons ?? [] };
}

export const postKill = (enemy: string, eventKey: string) => call<{ xp: number; level: number; levelled_up: boolean }>("/api/combat/kill", "xp", { enemy, event_key: eventKey });
export const postWear = (weapon: string, hits: number, defeated: boolean) => call<{ durability: number }>("/api/combat/wear", "weapon", { weapon, hits: Math.min(500, hits), defeated, idempotency_key: key("wear") });
export const startMissionRemote = (mission: string) => call<{ progress_id: string; resumed: boolean }>("/api/combat/missions/start", "mission", { mission, start_key: key("start") });
export const postMissionEvents = (progressId: string, events: MissionEvent[]) => call<{ state: string; counter: number }>("/api/combat/missions/progress", "mission", { progress_id: progressId, events });
export const completeMissionRemote = (progressId: string) => call<{ xp_awarded: number; coins_awarded: number; materials_awarded: Record<string, number> }>("/api/combat/missions/complete", "rewards", { progress_id: progressId });
/** The board's server view: per mission, whether it can start and when its 20 h cooldown ends. */
export const missionBoard = () => call<{ key: string; can_start: boolean; cooldown_until: string | null }[]>("/api/combat/missions", "missions");
/** After the boss kill posts: the server rolls the guardian's drop table once per kill. */
export const claimBossReward = (eventKey: string) => call<{ reward: BossReward; replayed: boolean }>("/api/combat/boss-reward", "boss", { event_key: eventKey });
