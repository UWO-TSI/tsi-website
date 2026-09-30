import type { SupabaseClient } from "@supabase/supabase-js";
import type { Donation, MemberItem, WeeklyBest } from "./logic";
import { ROSTER, type Species } from "./roster";
import { raisePg } from "@/lib/result";
import type { CollectionsStore } from "./store";

type Row = Record<string, unknown>;
const raise = (error: { code?: string; message?: string } | null): never =>
  raisePg(error, ["already_donated", "not_owned", "not_donatable", "rate_limited", "too_fast", "no_roll", "roll_expired", "already_landed", "already_harvested", "out_of_season"]);
const one = (data: unknown) => (Array.isArray(data) ? data[0] : data) as Row;
const caught = (r: Row) => ({
  count: Number(r.count), total_collected: Number(r.total_collected), best_size_cm: num(r.best_size_cm), new_record: r.new_record === true,
  recipe: r.recipe_id ? { id: String(r.recipe_id), name: String(r.recipe_name) } : null,
});
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toSpecies(r: Row): Species {
  return {
    key: String(r.key), category: r.category as Species["category"], sub: (r.sub as string) ?? null, name: String(r.name),
    biome: r.biome as Species["biome"], tool: r.tool as Species["tool"], rarity: r.rarity as Species["rarity"],
    size: r.size_min_cm === null ? null : [Number(r.size_min_cm), Number(r.size_max_cm)],
    hours: r.start_hour === null ? null : [Number(r.start_hour), Number(r.end_hour)],
    rainAnyHour: r.rain_any_hour === true, weather: (r.weather as Species["weather"]) ?? [], months: ((r.months as number[]) ?? []).map(Number),
    oneLiner: String(r.one_liner ?? ""), icon: (r.icon as string) ?? null, model: (r.model as string) ?? null,
    assetReady: r.asset_ready !== false, donatable: r.donatable === true, wing: (r.wing as Species["wing"]) ?? null, position: Number(r.position ?? 0),
  };
}

async function names(db: SupabaseClient, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await db.from("profiles").select("id, display_name").in("id", ids);
  for (const p of (data ?? []) as Row[]) out.set(String(p.id), String(p.display_name ?? "Member"));
  return out;
}

export function supabaseCollectionsStore(db: SupabaseClient): CollectionsStore {
  let rosterCache: Species[] | null = null;
  return {
    async roster() {
      if (rosterCache) return rosterCache;
      const { data, error } = await db.from("collection_species").select("*").eq("active", true).order("position");
      // Pre-031 databases: the code roster is the same content.
      if (error) return (rosterCache = ROSTER);
      return (rosterCache = ((data ?? []) as Row[]).map(toSpecies));
    },
    async memberItems(memberId) {
      const full = await db.from("member_collections").select("item_key, count, total_collected, best_size_cm, first_collected_at").eq("user_id", memberId);
      if (!full.error) {
        return ((full.data ?? []) as Row[]).map((r) => ({ item_key: String(r.item_key), count: Number(r.count), total_collected: Number(r.total_collected), best_size_cm: num(r.best_size_cm), first_collected_at: String(r.first_collected_at) }));
      }
      // 023 without 031's columns: discovery still works.
      const basic = await db.from("member_collections").select("item_key, count, first_collected_at").eq("user_id", memberId);
      if (basic.error) raise(basic.error);
      return ((basic.data ?? []) as Row[]).map((r): MemberItem => ({ item_key: String(r.item_key), count: Number(r.count), total_collected: Number(r.count), best_size_cm: null, first_collected_at: String(r.first_collected_at) }));
    },
    async donations() {
      const { data, error } = await db.from("museum_donations").select("species_key, donor_id, donated_at, size_cm");
      if (error) raise(error);
      const rows = (data ?? []) as Row[];
      const n = await names(db, [...new Set(rows.map((r) => r.donor_id).filter(Boolean).map(String))]);
      return rows.map((r): Donation => ({ species_key: String(r.species_key), donor_id: (r.donor_id as string) ?? null, donor_name: r.donor_id ? (n.get(String(r.donor_id)) ?? null) : null, donated_at: String(r.donated_at), size_cm: num(r.size_cm) }));
    },
    async findDonation(memberId, key) {
      const { data, error } = await db.from("museum_donations").select("species_key, donor_id, donated_at, size_cm").eq("donor_id", memberId).eq("idempotency_key", key).maybeSingle();
      if (error) raise(error);
      if (!data) return null;
      const r = data as Row;
      return { species_key: String(r.species_key), donor_id: memberId, donor_name: null, donated_at: String(r.donated_at), size_cm: num(r.size_cm) };
    },
    async donate(memberId, speciesKey, key, size) {
      const { data, error } = await db.rpc("museum_donate", { p_member_id: memberId, p_species_key: speciesKey, p_idempotency_key: key, p_size: size });
      if (error) raise(error);
      const r = (Array.isArray(data) ? data[0] : data) as Row;
      return { replayed: r?.replayed === true };
    },
    async weeklyBests(week) {
      const { data, error } = await db.from("weekly_catch_bests").select("user_id, item_key, size_cm, caught_at").eq("week_start", week);
      if (error) raise(error);
      const rows = (data ?? []) as Row[];
      const n = await names(db, [...new Set(rows.map((r) => String(r.user_id)))]);
      return rows.map((r): WeeklyBest => ({ user_id: String(r.user_id), member_name: n.get(String(r.user_id)) ?? "Member", item_key: String(r.item_key), size_cm: Number(r.size_cm), caught_at: String(r.caught_at) }));
    },
    async recordCatch(memberId, key, size, trophy) {
      const { data, error } = await db.rpc("collections_record_catch", { p_member_id: memberId, p_item_key: key, p_size: size, p_trophy: trophy });
      if (error) raise(error);
      return caught(one(data));
    },
    async cast(memberId, key, size, trophy) {
      const { data, error } = await db.rpc("collections_cast", { p_member_id: memberId, p_item_key: key, p_size: size, p_trophy: trophy });
      if (error) raise(error);
      return String(data);
    },
    async land(memberId, rollId, seasonal) {
      // collections_land_drop (20260930100000): seasonal_land (collections_land with the seasonal checks) and the recipe drop, in one transaction.
      const { data, error } = await db.rpc("collections_land_drop", { p_member_id: memberId, p_roll_id: rollId, p_closed: seasonal?.closed ?? [], p_goal_id: seasonal?.tourney?.goal_id ?? null, p_cycle: seasonal?.tourney?.cycle ?? null });
      if (error) raise(error);
      const r = one(data);
      return { item_key: String(r.item_key), size_cm: num(r.size_cm), ...caught(r) };
    },
    async harvest(memberId, nodeId, hourKey, key, size, trophy) {
      const { data, error } = await db.rpc("collections_harvest_drop", { p_member_id: memberId, p_node_id: nodeId, p_hour_key: hourKey, p_item_key: key, p_size: size, p_trophy: trophy });
      if (error) raise(error);
      return caught(one(data));
    },
    async ownedGear(memberId) {
      // Before the economy migration nobody owns gear: the starter rod.
      const { data, error } = await db.from("member_inventory").select("shop_items(catalogue_ref)").eq("member_id", memberId);
      if (error) return [];
      return ((data ?? []) as Row[]).flatMap((r) => ((r.shop_items as Row | null)?.catalogue_ref as string | null) ?? []);
    },
    async tourneyEntries(goalId, cycle) {
      const { data, error } = await db.from("tourney_entries").select("member_id, category, item_key, size_cm, caught_at").eq("goal_id", goalId).eq("cycle", cycle);
      if (error) raise(error);
      const rows = (data ?? []) as Row[];
      const n = await names(db, [...new Set(rows.map((r) => String(r.member_id)))]);
      return rows.map((r) => ({ member_id: String(r.member_id), member_name: n.get(String(r.member_id)) ?? "Member", category: r.category as "fish" | "sea", item_key: String(r.item_key), size_cm: Number(r.size_cm), caught_at: String(r.caught_at) }));
    },
    async showcase(memberId) {
      const { data, error } = await db.from("member_showcase").select("slot, item_key").eq("member_id", memberId);
      if (error) raise(error);
      const out: (string | null)[] = [null, null, null];
      for (const r of (data ?? []) as Row[]) out[Number(r.slot) - 1] = String(r.item_key);
      return out;
    },
    async setShowcase(memberId, keys) {
      const del = await db.from("member_showcase").delete().eq("member_id", memberId);
      if (del.error) raise(del.error);
      const rows = keys.flatMap((k, i) => (k ? [{ member_id: memberId, slot: i + 1, item_key: k }] : []));
      if (rows.length) {
        const ins = await db.from("member_showcase").insert(rows);
        if (ins.error) raise(ins.error);
      }
    },
  };
}
