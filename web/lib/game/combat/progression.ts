/**
 * Island side of /api/combat/*: the gate check and progression (rows 179,
 * 207), kill XP, weapon wear, mission start/progress/complete, and the
 * Oracle's path choices (subclass, loadout, stats). Each call is idempotent
 * on the server; failures leave the local encounter playable.
 */
import type { CombatProgression } from "./contract";
import type { StatBlock } from "@/lib/combat/progression";
import type { MissionEvent } from "@/lib/combat/missions";
import type { BossReward } from "@/lib/combat/content";
import type { getProgression } from "@/lib/combat/service";
import { installCombatDemo } from "./demo";

/** GET /api/combat/progression's `progression`: level, stats and points, derived numbers, family/subclass and choices, kit and loadout, traits, fees, weapons. */
export type ProgressionView = Extract<Awaited<ReturnType<typeof getProgression>>, { ok: true }>["data"];
export interface IslandProgression extends CombatProgression { stats: StatBlock | null; maxHp: number | null; weapons: { weapon_key: string; durability: number }[]; view: ProgressionView | null }

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
  const r = await call<ProgressionView>("/api/combat/progression", "progression");
  if (!r.ok) return { level: 1, family: null, subclass: null, gateOpen: false, reason: r.status === 401 ? "Sealed. Sign in to enter the ruins." : r.error, stats: null, maxHp: null, weapons: [], view: null };
  const gate = r.raw.gate as CombatProgression;
  return { ...gate, stats: r.data.stats, maxHp: r.data.derived?.max_hp ?? null, weapons: r.data.weapons ?? [], view: r.data };
}

/** A kill; a Transmuter's first defeat of a species names the trait it just learned (row 40). */
export const postKill = (enemy: string, eventKey: string) => call<{ xp: number; level: number; levelled_up: boolean; trait_unlocked?: string | null }>("/api/combat/kill", "xp", { enemy, event_key: eventKey });
/** The Oracle's path: level-10 subclass choice (a change costs coins), four equipped abilities, stat totals, and the paid reset. */
export const chooseSubclassRemote = (subclass: string) => call<{ subclass: string; fee: number; replayed: boolean }>("/api/combat/subclass", "subclass", { subclass, idempotency_key: key("subclass") });
export const setLoadoutRemote = (loadout: string[]) => call<string[]>("/api/combat/loadout", "loadout", { loadout });
export const allocateRemote = (stats: StatBlock) => call<StatBlock>("/api/combat/allocate", "stats", stats);
export const resetStatsRemote = () => call<{ fee: number; replayed: boolean }>("/api/combat/reset-stats", "reset", { idempotency_key: key("reset") });
/** A run's wear: `hits` is undefined when no hit landed with this weapon (a defeat before the first hit still costs its 10%). */
export const postWear = (weapon: string, hits: number | undefined, defeated: boolean) => call<{ durability: number }>("/api/combat/wear", "weapon", { weapon, hits: Math.min(500, hits ?? 0), defeated, idempotency_key: key("wear") });
export const startMissionRemote = (mission: string) => call<{ progress_id: string; resumed: boolean }>("/api/combat/missions/start", "mission", { mission, start_key: key("start") });
export const postMissionEvents = (progressId: string, events: MissionEvent[]) => call<{ state: string; counter: number }>("/api/combat/missions/progress", "mission", { progress_id: progressId, events });
export const completeMissionRemote = (progressId: string) => call<{ xp_awarded: number; coins_awarded: number; materials_awarded: Record<string, number> }>("/api/combat/missions/complete", "rewards", { progress_id: progressId });
/** The board's server view: per mission, whether it can start and when its 20 h cooldown ends. */
export const missionBoard = () => call<{ key: string; can_start: boolean; cooldown_until: string | null }[]>("/api/combat/missions", "missions");
/** After the boss kill posts: the server rolls the guardian's drop table once per kill. */
export const claimBossReward = (eventKey: string) => call<{ reward: BossReward; replayed: boolean }>("/api/combat/boss-reward", "boss", { event_key: eventKey });
