/**
 * Supabase implementation of ProgressionStore. Uses the service-role client:
 * members have read-only RLS on these tables and every write is validated
 * by service.ts first (20260926150200_progression.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeChapter } from "./chapters";
import { normalizeGoal } from "./goals";
import { raisePg } from "@/lib/result";
import { StoreError, type CommitInput, type ProgressionStore, type RealActivity } from "./store";
import type { LetterView, MemberChapterProgress } from "./types";
import { questFacts } from "./facts";
import { ledgerToolsTaught } from "@/lib/game/arrival/arrivalLedger";
import { DROPS, releasedChapters, releasedGoals, type DropFlags } from "@/lib/game/drops";

const raise = (error: { code?: string; message?: string } | null | undefined): never => raisePg(error, ["cap_exceeded", "insufficient"]);

type Row = Record<string, unknown>;

/**
 * `flags`: the live drop (lib/game/drops.ts). Goals and chapters that open a region of a later drop aren't listed (their
 * rows and everyone's progress stay as they are), and chapter steps that need one are hidden, so nothing a member is
 * offered, credited or told to do points at a place that isn't open yet.
 */
export function supabaseProgressionStore(db: SupabaseClient, flags: DropFlags = DROPS): ProgressionStore {
  return {
    async listGoals() {
      const { data, error } = await db.from("club_goals").select("*").eq("active", true).order("position");
      if (error) raise(error);
      return releasedGoals(((data ?? []) as Row[]).map(normalizeGoal), flags);
    },
    async listChapters() {
      const { data, error } = await db.from("quest_chapters").select("*").eq("active", true).order("position");
      if (error) raise(error);
      return releasedChapters(((data ?? []) as Row[]).map(normalizeChapter), flags);
    },
    async memberProgress(memberId) {
      const { data, error } = await db
        .from("member_quest_progress")
        .select("chapter_id, status, steps_done, donated_item_key, completed_at")
        .eq("member_id", memberId);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map((r) => ({
        chapter_id: String(r.chapter_id),
        status: r.status as MemberChapterProgress["status"],
        steps_done: (r.steps_done && typeof r.steps_done === "object" ? r.steps_done : {}) as Record<string, string>,
        donated_item_key: (r.donated_item_key as string | null) ?? null,
        completed_at: (r.completed_at as string | null) ?? null,
      }));
    },
    async saveMemberProgress(memberId, chapterId, next, completedAt) {
      const { error } = await db.from("member_quest_progress").upsert(
        { member_id: memberId, chapter_id: chapterId, ...next, completed_at: completedAt, updated_at: new Date().toISOString() },
        { onConflict: "member_id,chapter_id" },
      );
      if (error) raise(error);
    },
    async memberFacts(memberId) {
      const [profile, prefs, catches, combat, gear, taught, donations, handIns, digs] = await Promise.all([
        db.from("profiles").select("tier, class").eq("id", memberId).maybeSingle(),
        db.from("member_quest_prefs").select("hud_muted, family_trial_completed_at").eq("member_id", memberId).maybeSingle(),
        db.from("member_collections").select("item_key, count, total_collected, updated_at").eq("user_id", memberId),
        db.from("member_progression").select("subclass").eq("member_id", memberId).maybeSingle(),
        db.from("member_inventory").select("shop_items(slug, catalogue_ref)").eq("member_id", memberId),
        ledgerToolsTaught(db, memberId),
        db.from("museum_donations").select("species_key, donor_id"),
        db.from("museum_handins").select("species_key, member_id"),
        db.from("member_digs").select("digs").eq("member_id", memberId).maybeSingle(),
      ]);
      if (profile.error) raise(profile.error);
      if (prefs.error) raise(prefs.error);
      // The main quest's tallies: a failed read fails the request rather than showing steps undone.
      for (const r of [catches, gear, donations, handIns, digs]) if (r.error) raise(r.error);
      const p = (profile.data ?? {}) as Row;
      const pr = (prefs.data ?? {}) as Row;
      const rows = ((catches.data ?? []) as Row[]).map((r) => ({ item_key: String(r.item_key), total: Math.max(Number(r.count) || 0, Number(r.total_collected) || 0), updated_at: typeof r.updated_at === "string" ? r.updated_at : null }));
      const owned = ((gear.data ?? []) as Row[]).flatMap((r) => { const item = r.shop_items as Row | null; return [item?.slug, item?.catalogue_ref].filter((k): k is string => typeof k === "string"); });
      const quest = questFacts(memberId, rows, owned, taught, ((donations.data ?? []) as Row[]).map((d) => ({ species_key: String(d.species_key), donor_id: typeof d.donor_id === "string" ? d.donor_id : null })),
        ((handIns.data ?? []) as Row[]).map((h) => ({ species_key: String(h.species_key), member_id: String(h.member_id) })), Number((digs.data as Row | null)?.digs ?? 0));
      // Row 207: no family trial; the level-10 moment is the subclass choice (what opens the ruins gate).
      // The flag stays for a manual grant. Before the combat migration: not done.
      const trial = typeof pr.family_trial_completed_at === "string" || typeof (combat.data as Row | null)?.subclass === "string";
      return {
        ...quest,
        counts: { ...quest.counts, oracle: typeof p.class === "string" && p.class.length > 0 ? 1 : 0, trial: trial ? 1 : 0 },
        tier: typeof p.tier === "number" ? p.tier : 5,
        hudMuted: pr.hud_muted === true,
      };
    },
    async setHudMuted(memberId, muted) {
      const { error } = await db
        .from("member_quest_prefs")
        .upsert({ member_id: memberId, hud_muted: muted, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
      if (error) raise(error);
    },
    async goalProgress(goalId, cycle) {
      const { data, error } = await db.from("club_goal_progress").select("points, contributors").eq("goal_id", goalId).eq("cycle", cycle).maybeSingle();
      if (error) raise(error);
      const r = (data ?? {}) as Row;
      return { points: Number(r.points ?? 0), contributors: Number(r.contributors ?? 0) };
    },
    async memberTotals(goalId, cycle, memberId) {
      const { data, error } = await db
        .from("club_goal_member_totals")
        .select("credited_points, delivery_points")
        .eq("goal_id", goalId)
        .eq("cycle", cycle)
        .eq("member_id", memberId)
        .maybeSingle();
      if (error) raise(error);
      const r = (data ?? {}) as Row;
      return { credited_points: Number(r.credited_points ?? 0), delivery_points: Number(r.delivery_points ?? 0) };
    },
    async completion(goalId, cycle) {
      const { data, error } = await db.from("club_goal_completions").select("completed_at").eq("goal_id", goalId).eq("cycle", cycle).maybeSingle();
      if (error) raise(error);
      return data ? String((data as Row).completed_at) : null;
    },
    async findContribution(memberId, key) {
      const { data, error } = await db
        .from("club_goal_contributions")
        .select("id, goal_id, credited_points")
        .eq("member_id", memberId)
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) raise(error);
      if (!data) return null;
      const r = data as Row;
      return { id: String(r.id), goal_id: String(r.goal_id), credited_points: Number(r.credited_points), replayed: true };
    },
    async commitContribution(i: CommitInput) {
      const { data, error } = await db.rpc("progression_commit_contribution", {
        p_goal_id: i.goalId,
        p_cycle: i.cycle,
        p_member_id: i.memberId,
        p_source: i.source,
        p_kind: i.kind,
        p_item_key: i.itemKey,
        p_amount: i.amount,
        p_amount_used: i.amountUsed,
        p_weight: i.weight,
        p_credited: i.credited,
        p_capped: i.capped,
        p_member_cap: i.memberCap,
        p_delivery_cap: i.deliveryCap,
        p_idempotency_key: i.idempotencyKey,
        p_ref_id: i.refId,
        p_note: i.note,
        p_created_by: i.createdBy,
      });
      if (error) raise(error);
      const r = (Array.isArray(data) ? data[0] : data) as Row | undefined;
      if (!r) throw new StoreError("failed", "empty commit result");
      return { id: String(r.contribution_id), replayed: r.replayed === true, credited_points: Number(r.credited_points) };
    },
    async markGoalComplete(goalId, cycle, total) {
      const { data, error } = await db
        .from("club_goal_completions")
        .upsert({ goal_id: goalId, cycle, total_points: total }, { onConflict: "goal_id,cycle", ignoreDuplicates: true })
        .select("goal_id");
      if (error) raise(error);
      return Array.isArray(data) && data.length > 0;
    },
    async realActivity(since, until) {
      let events = db
        .from("event_attendance")
        .select("id, user_id, events!inner(start_time)")
        .eq("status", "attended");
      if (since) events = events.gte("events.start_time", since.toISOString());
      if (until) events = events.lte("events.start_time", until.toISOString());
      let bounties = db.from("bounty_claims").select("id, user_id, completed_at").eq("status", "completed");
      if (since) bounties = bounties.gte("completed_at", since.toISOString());
      if (until) bounties = bounties.lte("completed_at", until.toISOString());
      const [ev, bo] = await Promise.all([events, bounties]);
      if (ev.error) raise(ev.error);
      if (bo.error) raise(bo.error);
      const out: RealActivity[] = [];
      for (const r of (ev.data ?? []) as Row[]) if (r.user_id) out.push({ source: "event", ref_id: String(r.id), member_id: String(r.user_id) });
      for (const r of (bo.data ?? []) as Row[]) if (r.user_id) out.push({ source: "bounty", ref_id: String(r.id), member_id: String(r.user_id) });
      return out;
    },
    async creditedRefs(goalId, cycle) {
      const { data, error } = await db
        .from("club_goal_contributions")
        .select("source, ref_id")
        .eq("goal_id", goalId)
        .eq("cycle", cycle)
        .not("ref_id", "is", null);
      if (error) raise(error);
      return new Set(((data ?? []) as Row[]).map((r) => `${r.source}:${r.ref_id}`));
    },
    async broadcastSystemLetter(key, subject, body) {
      const { data: members, error } = await db.from("profiles").select("id").eq("is_active", true);
      if (error) raise(error);
      const rows = ((members ?? []) as Row[]).map((m) => ({ kind: "system", recipient_id: String(m.id), subject, body, broadcast_key: key }));
      if (rows.length === 0) return;
      const res = await db.from("letters").upsert(rows, { onConflict: "broadcast_key,recipient_id", ignoreDuplicates: true });
      if (res.error) raise(res.error);
    },
    async sendSystemLetter(memberId, key, subject, body) {
      const res = await db
        .from("letters")
        .upsert({ kind: "system", recipient_id: memberId, subject, body, broadcast_key: key }, { onConflict: "broadcast_key,recipient_id", ignoreDuplicates: true });
      if (res.error) raise(res.error);
    },
    async countNotesSince(senderId, since, recipientId) {
      let q = db.from("letters").select("id", { count: "exact", head: true }).eq("sender_id", senderId).eq("kind", "note").gte("created_at", since.toISOString());
      if (recipientId) q = q.eq("recipient_id", recipientId);
      const { count, error } = await q;
      if (error) raise(error);
      return count ?? 0;
    },
    async memberExists(memberId) {
      const { data, error } = await db.from("profiles").select("id").eq("id", memberId).maybeSingle();
      if (error) raise(error);
      return !!data;
    },
    async insertNote(senderId, recipientId, subject, body) {
      const { data, error } = await db
        .from("letters")
        .insert({ kind: "note", sender_id: senderId, recipient_id: recipientId, subject, body })
        .select("id, created_at")
        .single();
      if (error) raise(error);
      const r = data as Row;
      return { id: String(r.id), created_at: String(r.created_at) };
    },
    async listLetters(memberId, limit) {
      const { data, error } = await db
        .from("letters")
        .select("id, kind, sender_id, recipient_id, subject, body, created_at, read_at, reported, hidden")
        .or(`recipient_id.eq.${memberId},sender_id.eq.${memberId}`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) raise(error);
      const rows = ((data ?? []) as Row[]).filter((r) => !(r.hidden === true && r.recipient_id === memberId));
      const ids = [...new Set(rows.flatMap((r) => [r.sender_id, r.recipient_id]).filter(Boolean).map(String))];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await db.from("profiles").select("id, display_name").in("id", ids);
        for (const p of (profiles ?? []) as Row[]) names.set(String(p.id), String(p.display_name ?? "Member"));
      }
      return rows.map(
        (r): LetterView => ({
          id: String(r.id),
          kind: r.kind === "note" ? "note" : "system",
          sender_id: (r.sender_id as string | null) ?? null,
          sender_name: r.sender_id ? (names.get(String(r.sender_id)) ?? "Member") : "HQ",
          recipient_id: String(r.recipient_id),
          recipient_name: names.get(String(r.recipient_id)) ?? "Member",
          subject: String(r.subject ?? ""),
          body: String(r.body ?? ""),
          created_at: String(r.created_at),
          read_at: (r.read_at as string | null) ?? null,
          reported: r.reported === true,
          outgoing: r.sender_id === memberId && r.recipient_id !== memberId,
        }),
      );
    },
    async markLetterRead(memberId, letterId, at) {
      const { data, error } = await db
        .from("letters")
        .update({ read_at: at })
        .eq("id", letterId)
        .eq("recipient_id", memberId)
        .is("read_at", null)
        .select("id");
      if (error) raise(error);
      if (Array.isArray(data) && data.length > 0) return true;
      const { data: exists } = await db.from("letters").select("id").eq("id", letterId).eq("recipient_id", memberId).maybeSingle();
      return !!exists;
    },
    async grantItem(memberId, slug) {
      // As the economy's own grants write it (20260926160000_crafting): the item's slot, one, nothing if it's there.
      const { data: item, error } = await db.from("shop_items").select("id, slot").eq("slug", slug).maybeSingle();
      if (error) raise(error);
      if (!item) throw new StoreError("not_found", `no shop item ${slug}`);
      const { error: insert } = await db.from("member_inventory").upsert({ member_id: memberId, item_id: (item as Row).id, qty: 1, slot: (item as Row).slot }, { onConflict: "member_id,item_id", ignoreDuplicates: true });
      if (insert) raise(insert);
    },
    async grantXp(memberId, amount, ref, key) {
      const { data, error } = await db.rpc("combat_grant_xp", { p_member_id: memberId, p_amount: amount, p_source: "chapter", p_ref: ref, p_key: key });
      if (error) raise(error);
      const r = (Array.isArray(data) ? data[0] : data) as Row;
      return { total: Number(r.xp), level: Number(r.level), levelled_up: r.levelled_up === true, replayed: r.replayed === true };
    },
    async creditCoins(memberId, amount, source, ref, key) {
      const { data, error } = await db.rpc("wallet_apply", { p_member_id: memberId, p_currency: "coins", p_amount: amount, p_source: source, p_ref: ref, p_idempotency_key: key });
      if (error) raise(error);
      const r = (Array.isArray(data) ? data[0] : data) as Row;
      return { balance: Number(r.balance), replayed: r.replayed === true };
    },
    async reportLetter(memberId, letterId, reason, at) {
      const { data, error } = await db
        .from("letters")
        .update({ reported: true, reported_reason: reason || null, reported_at: at })
        .eq("id", letterId)
        .eq("recipient_id", memberId)
        .eq("kind", "note")
        .select("id");
      if (error) raise(error);
      return Array.isArray(data) && data.length > 0;
    },
  };
}
