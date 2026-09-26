import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudySession } from "./rules";
import { StudyError, type ChatMessage, type StudyStore, type StudyTable } from "./store";

type Row = Record<string, unknown>;
function raise(error: { code?: string; message?: string; details?: string } | null): never {
  const code = error?.code ?? "";
  const msg = `${error?.message ?? ""} ${error?.details ?? ""}`;
  if (["42P01", "PGRST205", "PGRST202", "42703", "42883"].includes(code) || /does not exist|schema cache/i.test(msg)) throw new StudyError("unavailable", msg);
  if (code === "23505" && msg.includes("idx_study_seat_taken")) throw new StudyError("seat_taken");
  if (code === "23505" && msg.includes("idx_study_member_active")) throw new StudyError("already_seated");
  throw new StudyError("failed", msg);
}
const SESSION_COLS =
  "id, member_id, table_id, seat, focus_len, break_len, cycles, phase, cycle_index, started_at, phase_started_at, last_heartbeat, ended_at, end_reason, minutes_completed, blocks_completed, bonus_earned, longest_block, coins_paid, settled_at, version";
const toSession = (r: Row) => r as unknown as StudySession;
const toTable = (r: Row): StudyTable => ({
  id: String(r.id), slug: String(r.slug), label: String(r.label), location: String(r.location), anchor: String(r.anchor), kind: r.kind as StudyTable["kind"],
  seats: Number(r.seats), host_id: (r.host_id as string) ?? null, is_private: r.is_private === true, allowed: ((r.allowed as string[]) ?? []).map(String), position: Number(r.position ?? 0),
});

export function supabaseStudyStore(db: SupabaseClient): StudyStore {
  return {
    async listTables() {
      const { data, error } = await db.from("study_tables").select("*").eq("active", true).order("position");
      if (error) raise(error);
      return ((data ?? []) as Row[]).map(toTable);
    },
    async updateTable(id, patch) {
      const { error } = await db.from("study_tables").update(patch).eq("id", id);
      if (error) raise(error);
    },
    async activeSessions(tableId) {
      let q = db.from("study_sessions").select(SESSION_COLS).is("ended_at", null);
      if (tableId) q = q.eq("table_id", tableId);
      const { data, error } = await q;
      if (error) raise(error);
      return ((data ?? []) as Row[]).map(toSession);
    },
    async memberActive(m) {
      const { data, error } = await db.from("study_sessions").select(SESSION_COLS).eq("member_id", m).is("ended_at", null).maybeSingle();
      if (error) raise(error);
      return data ? toSession(data as Row) : null;
    },
    async memberUnsettled(m) {
      const { data, error } = await db.from("study_sessions").select(SESSION_COLS).eq("member_id", m).not("ended_at", "is", null).is("settled_at", null);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map(toSession);
    },
    async insertSession(s) {
      const { error } = await db.from("study_sessions").insert(s);
      if (error) raise(error);
    },
    async updateSession(s) {
      const { id, version, member_id: _m, ...rest } = s;
      void _m;
      const { data, error } = await db.from("study_sessions").update({ ...rest, version: version + 1 }).eq("id", id).eq("version", version).select("id");
      if (error) raise(error);
      return Array.isArray(data) && data.length > 0;
    },
    async getSession(id) {
      const { data, error } = await db.from("study_sessions").select(SESSION_COLS).eq("id", id).maybeSingle();
      if (error) raise(error);
      return data ? toSession(data as Row) : null;
    },
    async settle(sessionId, memberId) {
      const { data, error } = await db.rpc("study_settle", { p_session_id: sessionId, p_member_id: memberId });
      if (error) raise(error);
      const r = (Array.isArray(data) ? data[0] : data) as Row;
      return { coins: Number(r.coins), replayed: r.replayed === true };
    },
    async names(ids) {
      const out = new Map<string, string>();
      if (!ids.length) return out;
      const { data } = await db.from("profiles").select("id, display_name").in("id", ids);
      for (const p of (data ?? []) as Row[]) out.set(String(p.id), String(p.display_name ?? "Member"));
      return out;
    },
    async looks(ids) {
      const out = new Map<string, unknown>();
      if (!ids.length) return out;
      // No error check on purpose: before 20260926170000 production has no avatar_config, and mates then get default looks.
      const { data } = await db.from("profiles").select("id, avatar_config").in("id", ids);
      for (const p of (data ?? []) as Row[]) {
        const look = (p.avatar_config as { look?: unknown } | null)?.look;
        if (look) out.set(String(p.id), look);
      }
      return out;
    },
    async weekStats(week) {
      const { data, error } = await db.from("study_weekly_stats").select("member_id, minutes, longest_block, sessions").eq("week_start", week);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map((r) => ({ member_id: String(r.member_id), minutes: Number(r.minutes), longest_block: Number(r.longest_block), sessions: Number(r.sessions) }));
    },
    async boardOptIns() {
      const { data, error } = await db.from("member_study_prefs").select("member_id").eq("board_opt_in", true);
      if (error) raise(error);
      return new Set(((data ?? []) as Row[]).map((r) => String(r.member_id)));
    },
    async setBoardOptIn(m, on) {
      const { error } = await db.from("member_study_prefs").upsert({ member_id: m, board_opt_in: on, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
      if (error) raise(error);
    },
    async insertChat(tableId, m, body) {
      const { data, error } = await db.from("study_chat_messages").insert({ table_id: tableId, member_id: m, body }).select("id, table_id, member_id, body, created_at, reported, reported_by").single();
      if (error) raise(error);
      return data as ChatMessage;
    },
    async listChat(tableId, since, limit) {
      const { data, error } = await db.from("study_chat_messages").select("id, table_id, member_id, body, created_at, reported, reported_by")
        .eq("table_id", tableId).eq("hidden", false).gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(limit);
      if (error) raise(error);
      return ((data ?? []) as ChatMessage[]).reverse();
    },
    async countChatSince(m, since) {
      const { count, error } = await db.from("study_chat_messages").select("id", { count: "exact", head: true }).eq("member_id", m).gte("created_at", since.toISOString());
      if (error) raise(error);
      return count ?? 0;
    },
    async reportChat(id, tableId, reporter, reason) {
      const { data, error } = await db.from("study_chat_messages").update({ reported: true, reported_by: reporter, reported_reason: reason || null, reported_at: new Date().toISOString() })
        .eq("id", id).eq("table_id", tableId).select("id");
      if (error) raise(error);
      return Array.isArray(data) && data.length > 0;
    },
  };
}
