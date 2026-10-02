import type { SupabaseClient } from "@supabase/supabase-js";
import type { Family } from "@/lib/oracle/engine";
import type { BossReward } from "./content";
import type { MissionProgress } from "./missions";
import { ZERO_STATS, type StatBlock } from "./progression";
import { raisePg } from "@/lib/result";
import { CombatError, type CombatErrorCode, type CombatStore, type ProgressRow } from "./store";

type Row = Record<string, unknown>;
const CODES: CombatErrorCode[] = ["bad_loadout", "no_subclass", "insufficient", "not_found", "not_owned", "needs_reset", "not_enough_points", "level_too_low", "wrong_family", "no_family", "cooldown", "not_ready", "kill_xp_cap", "unknown_enemy", "unknown_mission", "bad_hits", "boss_cooldown", "miniboss_cooldown"];
const raise = (error: { code?: string; message?: string } | null): never => raisePg(error, CODES);
const first = (d: unknown) => ((Array.isArray(d) ? d[0] : d) ?? {}) as Row;
const xpRes = (r: Row) => ({ xp: Number(r.xp), level: Number(r.level), levelled_up: r.levelled_up === true, replayed: r.replayed === true });

export function supabaseCombatStore(db: SupabaseClient): CombatStore {
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) raise(error);
    return data;
  };
  return {
    async progression(m) {
      await rpc("combat_ensure", { p_member_id: m });
      const { data, error } = await db.from("member_progression").select("xp, level, stats, subclass, loadout, traits").eq("member_id", m).single();
      if (error) raise(error);
      const r = data as Row;
      return { xp: Number(r.xp), level: Number(r.level), stats: { ...ZERO_STATS, ...(r.stats as StatBlock) }, subclass: (r.subclass as string) ?? null,
        loadout: (r.loadout as string[]) ?? [], traits: (r.traits as Record<string, number>) ?? {} };
    },
    async family(m) {
      const { data } = await db.from("member_identity").select("family").eq("member_id", m).maybeSingle();
      return ((data as Row | null)?.family as Family) ?? null;
    },
    grantXp: async (m, amount, source, ref, key) => xpRes(first(await rpc("combat_grant_xp", { p_member_id: m, p_amount: amount, p_source: source, p_ref: ref, p_key: key }))),
    recordKill: async (m, enemy, ev) => xpRes(first(await rpc("combat_record_kill", { p_member_id: m, p_enemy_key: enemy, p_event_key: ev }))),
    allocate: async (m, stats) => ({ ...ZERO_STATS, ...((await rpc("combat_allocate", { p_member_id: m, p_stats: stats })) as StatBlock) }),
    async resetStats(m, key) {
      const r = first(await rpc("combat_reset_stats", { p_member_id: m, p_key: key }));
      return { fee: Number(r.fee), replayed: r.replayed === true };
    },
    async chooseSubclass(m, subclass, family, key) {
      const r = first(await rpc("combat_choose_subclass", { p_member_id: m, p_subclass: subclass, p_subclass_family: family, p_key: key }));
      return { subclass: String(r.subclass), fee: Number(r.fee), replayed: r.replayed === true };
    },
    setLoadout: async (m, loadout) => ((await rpc("combat_set_loadout", { p_member_id: m, p_loadout: loadout })) as string[]) ?? [],
    async weapons(m) {
      const { data, error } = await db.from("member_weapons").select("weapon_key, durability, equipped").eq("member_id", m);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map((r) => ({ weapon_key: String(r.weapon_key), durability: Number(r.durability), equipped: r.equipped === true }));
    },
    async equip(m, k) {
      const own = await db.from("member_weapons").select("weapon_key").eq("member_id", m).eq("weapon_key", k).maybeSingle();
      if (own.error) raise(own.error);
      if (!own.data) throw new CombatError("not_owned");
      const off = await db.from("member_weapons").update({ equipped: false }).eq("member_id", m).eq("equipped", true);
      if (off.error) raise(off.error);
      const on = await db.from("member_weapons").update({ equipped: true }).eq("member_id", m).eq("weapon_key", k);
      if (on.error) raise(on.error);
    },
    async wear(m, k, hits, defeated, key) {
      const r = first(await rpc("combat_wear", { p_member_id: m, p_weapon_key: k, p_hits: hits, p_defeated: defeated, p_key: key }));
      return { durability: Number(r.durability), replayed: r.replayed === true };
    },
    async repair(m, k, key) {
      const r = first(await rpc("combat_repair", { p_member_id: m, p_weapon_key: k, p_key: key }));
      return { durability: Number(r.durability), cost: Number(r.cost), replayed: r.replayed === true };
    },
    async missionRows(m) {
      const { data, error } = await db.from("mission_progress").select("id, mission_key, state, progress, started_at, completed_at").eq("member_id", m).order("started_at", { ascending: false }).limit(200);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map((r): ProgressRow => ({
        id: String(r.id), mission_key: String(r.mission_key), state: r.state as ProgressRow["state"],
        progress: { ...(r.progress as MissionProgress), state: r.state as ProgressRow["state"] }, started_at: String(r.started_at), completed_at: (r.completed_at as string) ?? null,
      }));
    },
    async startMission(m, mk, startKey) {
      const r = first(await rpc("combat_mission_start", { p_member_id: m, p_mission_key: mk, p_start_key: startKey }));
      return { progress_id: String(r.progress_id), resumed: r.resumed === true };
    },
    async saveMission(m, id, state, progress) {
      const { data, error } = await db.from("mission_progress").update({ state, progress, updated_at: new Date().toISOString() })
        .eq("id", id).eq("member_id", m).in("state", ["active", "ready"]).select("id");
      if (error) raise(error);
      return Array.isArray(data) && data.length > 0;
    },
    async completeMission(m, id) {
      const r = first(await rpc("combat_mission_complete", { p_progress_id: id, p_member_id: m }));
      return { xp_awarded: Number(r.xp_awarded), coins_awarded: Number(r.coins_awarded), materials_awarded: (r.materials_awarded as Record<string, number>) ?? {}, replayed: r.replayed === true };
    },
    async bossReward(m, ev, reward) {
      const r = first(await rpc("combat_boss_reward", { p_member_id: m, p_event_key: ev, p_reward: reward }));
      return { reward: r.reward as BossReward, replayed: r.replayed === true };
    },
    async minibossReward(m, enemy, ev, reward) {
      const r = first(await rpc("combat_miniboss_reward", { p_member_id: m, p_enemy_key: enemy, p_event_key: ev, p_reward: reward }));
      return { reward: r.reward as BossReward, replayed: r.replayed === true };
    },
  };
}
