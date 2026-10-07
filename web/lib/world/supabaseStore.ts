import type { SupabaseClient } from "@supabase/supabase-js";
import { raisePg } from "@/lib/result";
import type { WorldErrorCode, WorldLine, WorldStore } from "./store";

type Row = Record<string, unknown>;
const CODES: WorldErrorCode[] = [];
const raise = (error: { code?: string; message?: string } | null): never => raisePg(error, CODES);
const LINE = "id, shard, room_id, area, member_id, world_name, body, created_at, hidden";
const toLine = (r: Row): WorldLine => ({
  id: String(r.id), shard: Number(r.shard), room_id: String(r.room_id), area: String(r.area), member_id: (r.member_id as string) ?? null,
  world_name: String(r.world_name), body: String(r.body), created_at: String(r.created_at), hidden: r.hidden === true,
});

/** The service-role store behind /api/world/* (RLS keeps chat and reports from members' own keys). */
export function supabaseWorldStore(db: SupabaseClient): WorldStore {
  return {
    async line(id) {
      const { data, error } = await db.from("world_chat_messages").select(LINE).eq("id", id).maybeSingle();
      if (error) raise(error);
      return data ? toLine(data as Row) : null;
    },
    async roomLines(roomId, limit, upTo) {
      let q = db.from("world_chat_messages").select(LINE).eq("room_id", roomId);
      if (upTo) q = q.lte("created_at", upTo);
      const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map(toLine);
    },
    async latestLineOf(memberId) {
      const { data, error } = await db.from("world_chat_messages").select(LINE).eq("member_id", memberId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) raise(error);
      return data ? toLine(data as Row) : null;
    },
    async memberExists(memberId) {
      const { data, error } = await db.from("profiles").select("id").eq("id", memberId).maybeSingle();
      if (error) raise(error);
      return !!data;
    },
    async reportsSince(reporterId, since) {
      const { count, error } = await db.from("world_reports").select("id", { count: "exact", head: true }).eq("reporter_id", reporterId).gte("created_at", since.toISOString());
      if (error) raise(error);
      return count ?? 0;
    },
    async insertReport(r) {
      const { data, error } = await db.from("world_reports").insert(r).select("id").single();
      if (!error) return { id: String((data as Row).id), duplicate: false };
      if (error.code !== "23505" || !r.line_id) raise(error);
      const { data: existing, error: again } = await db.from("world_reports").select("id").eq("reporter_id", r.reporter_id).eq("line_id", r.line_id!).maybeSingle();
      if (again || !existing) raise(again ?? error);
      return { id: String((existing as Row).id), duplicate: true };
    },
    async markReported(lineId) {
      const { error } = await db.from("world_chat_messages").update({ reported: true }).eq("id", lineId);
      if (error) raise(error);
    },
    async blocks(memberId) {
      const { data, error } = await db.from("world_blocks").select("blocked_id, created_at").eq("blocker_id", memberId).order("created_at", { ascending: false }).limit(500);
      if (error) raise(error);
      const rows = (data ?? []) as Row[];
      if (!rows.length) return [];
      const ids = rows.map((r) => String(r.blocked_id));
      const { data: names, error: namesError } = await db.from("member_identity").select("member_id, world_name").in("member_id", ids);
      if (namesError) raise(namesError);
      const name = new Map(((names ?? []) as Row[]).map((n) => [String(n.member_id), (n.world_name as string) ?? null]));
      return rows.map((r) => ({ member_id: String(r.blocked_id), world_name: name.get(String(r.blocked_id)) ?? null, created_at: String(r.created_at) }));
    },
    async addBlock(blocker, blocked) {
      const { error } = await db.from("world_blocks").insert({ blocker_id: blocker, blocked_id: blocked });
      if (!error) return "added";
      if (error.code === "23505") return "exists";
      if (error.code === "23503") return "not_found";
      return raise(error);
    },
    async removeBlock(blocker, blocked) {
      const { error } = await db.from("world_blocks").delete().eq("blocker_id", blocker).eq("blocked_id", blocked);
      if (error) raise(error);
    },
  };
}
