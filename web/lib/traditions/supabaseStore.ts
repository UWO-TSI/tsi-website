/**
 * Supabase TraditionsStore (20261013210000_traditions.sql), on the service-role client: the calendar (falling back to
 * the seeded traditions when the table can't be read), the residents' rows, tonight's treats, and traditions_treat.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_TRADITIONS, normalizeTradition } from "@/lib/content/traditions";
import type { DoorResident, TraditionsStore } from "./service";

export function supabaseTraditionsStore(db: SupabaseClient): TraditionsStore {
  return {
    async traditions() {
      const { data, error } = await db.from("traditions").select("*").eq("active", true);
      return error || !data ? [...DEFAULT_TRADITIONS] : (data as Record<string, unknown>[]).map(normalizeTradition);
    },
    async resident(slug) {
      const { data } = await db.from("npc_personas").select("slug, display_name, schedule").eq("slug", slug).eq("active", true).maybeSingle();
      return (data as DoorResident | null) ?? null;
    },
    async treated(memberId, night) {
      const { data } = await db.from("trick_or_treats").select("resident").eq("member_id", memberId).eq("night", night);
      return ((data ?? []) as { resident: string }[]).map((r) => r.resident);
    },
    async give(memberId, resident, night, itemKey) {
      const { data, error } = await db.rpc("traditions_treat", { p_member_id: memberId, p_resident: resident, p_night: night, p_item_key: itemKey });
      if (error) throw new Error(error.message);
      const row = (Array.isArray(data) ? data[0] : data) as { count?: number } | null;
      return { count: Number(row?.count ?? 1) };
    },
  };
}
