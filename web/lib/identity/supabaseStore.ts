import type { SupabaseClient } from "@supabase/supabase-js";
import type { Family } from "@/lib/oracle/engine";
import { readSettings } from "./settings";
import { raisePg } from "@/lib/result";
import type { Attempt, IdentityErrorCode, IdentityStore } from "./store";

type Row = Record<string, unknown>;
const CODES: IdentityErrorCode[] = ["name_taken", "too_soon", "forbidden", "cooldown", "insufficient", "not_found", "incomplete"];
const raise = (error: { code?: string; message?: string } | null): never => raisePg(error, CODES);
const first = (d: unknown) => ((Array.isArray(d) ? d[0] : d) ?? {}) as Row;
const toAttempt = (r: Row): Attempt => ({
  id: String(r.id), member_id: String(r.member_id), item_order: (r.item_order as string[]) ?? [], status: r.status as Attempt["status"], fee_paid: Number(r.fee_paid ?? 0),
  mbti_type: (r.mbti_type as string) ?? null, family: (r.family as Family) ?? null, started_at: String(r.started_at), completed_at: (r.completed_at as string) ?? null,
});
const ATTEMPT = "id, member_id, item_order, status, fee_paid, mbti_type, family, started_at, completed_at";

export function supabaseIdentityStore(db: SupabaseClient): IdentityStore {
  return {
    async identity(m) {
      const { data, error } = await db.from("member_identity").select("world_name, world_name_key, name_set_at, name_changes, mbti_type, family, quiz_taken_at, muted_until").eq("member_id", m).maybeSingle();
      if (error) raise(error);
      const r = (data ?? {}) as Row;
      return {
        world_name: (r.world_name as string) ?? null, world_name_key: (r.world_name_key as string) ?? null, name_set_at: (r.name_set_at as string) ?? null,
        name_changes: Number(r.name_changes ?? 0), mbti_type: (r.mbti_type as string) ?? null, family: (r.family as Family) ?? null,
        quiz_taken_at: (r.quiz_taken_at as string) ?? null, muted_until: (r.muted_until as string) ?? null,
      };
    },
    async profile(m) {
      const { data, error } = await db.from("profiles").select("tier, membership, is_active").eq("id", m).maybeSingle();
      if (error) raise(error);
      const r = (data ?? {}) as Row;
      return { tier: Number(r.tier ?? 5), membership: r.membership === "public" ? "public" : "member", is_active: r.is_active !== false };
    },
    async keyOwner(key) {
      const { data, error } = await db.from("member_identity").select("member_id").eq("world_name_key", key).maybeSingle();
      if (error) raise(error);
      return data ? String((data as Row).member_id) : null;
    },
    async setName(m, name, key, actor, days) {
      const { data, error } = await db.rpc("identity_set_name", { p_member_id: m, p_name: name, p_key: key, p_actor_id: actor, p_cooldown_days: days });
      if (error) raise(error);
      const r = first(data);
      return { world_name: String(r.world_name), name_changes: Number(r.name_changes), replayed: r.replayed === true };
    },
    async openAttempt(m) {
      const { data, error } = await db.from("oracle_attempts").select(ATTEMPT).eq("member_id", m).eq("status", "open").maybeSingle();
      if (error) raise(error);
      return data ? toAttempt(data as Row) : null;
    },
    async getAttempt(id) {
      const { data, error } = await db.from("oracle_attempts").select(ATTEMPT).eq("id", id).maybeSingle();
      if (error) raise(error);
      return data ? toAttempt(data as Row) : null;
    },
    async startAttempt(m, key, order, fee, days) {
      const { data, error } = await db.rpc("oracle_start", { p_member_id: m, p_start_key: key, p_item_order: order, p_fee: fee, p_cooldown_days: days });
      if (error) raise(error);
      const r = first(data);
      return { attempt_id: String(r.attempt_id), fee_paid: Number(r.fee_paid), resumed: r.resumed === true };
    },
    async saveAnswers(id, answers) {
      const rows = Object.entries(answers).map(([item_id, value]) => ({ attempt_id: id, item_id, value }));
      if (!rows.length) return;
      const { error } = await db.from("oracle_responses").upsert(rows, { onConflict: "attempt_id,item_id" });
      if (error) raise(error);
    },
    async answers(id) {
      const { data, error } = await db.from("oracle_responses").select("item_id, value").eq("attempt_id", id);
      if (error) raise(error);
      return Object.fromEntries(((data ?? []) as Row[]).map((r) => [String(r.item_id), Number(r.value)]));
    },
    async complete(id, m, type, family, scores, ties) {
      const { data, error } = await db.rpc("oracle_complete", { p_attempt_id: id, p_member_id: m, p_type: type, p_family: family, p_scores: scores, p_tie_answers: ties });
      if (error) raise(error);
      const r = first(data);
      return { family: r.family as Family, previous_family: (r.previous_family as Family) ?? null, aura_new: r.aura_new === true, replayed: r.replayed === true };
    },
    async auras(m) {
      const { data, error } = await db.from("family_auras").select("family").eq("member_id", m);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map((r) => r.family as Family);
    },
    async settings(m) {
      const { data, error } = await db.from("member_settings").select("text_size, high_contrast, key_bindings").eq("member_id", m).maybeSingle();
      if (error) raise(error);
      return readSettings(data ?? {});
    },
    async saveSettings(m, s) {
      const { error } = await db.from("member_settings").upsert({ member_id: m, ...s, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
      if (error) raise(error);
    },
    async report(reporter, target, reason) {
      const { error } = await db.from("identity_reports").upsert({ reporter_id: reporter, target_id: target, reason: reason || null }, { onConflict: "reporter_id,target_id", ignoreDuplicates: true });
      if (error) raise(error);
    },
    async resolveReports(target, status) {
      const { error } = await db.from("identity_reports").update({ status }).eq("target_id", target).eq("status", "open");
      if (error) raise(error);
    },
    async setMute(target, until) {
      const { error } = await db.from("member_identity").upsert({ member_id: target, muted_until: until }, { onConflict: "member_id" });
      if (error) raise(error);
    },
  };
}
