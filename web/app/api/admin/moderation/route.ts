// Moderation queue (row 221) for reported member text: notes in the letters
// table and study-table chat, world chat reports (multiplayer M2, a line or a
// player with the room's last 20 lines), and (read here, acted on through
// /api/identity/moderate with mutes, unmutes, world removals and restores) the
// open name reports. T1/T2 remove (hidden: a note stays only in its sender's sent
// list; a world line is marked hidden in the log), remove and mute the author 7
// days, or dismiss (clear the report, the text stays). Every action goes in the
// audit log, which GET returns with the members muted and removed now. A mute
// reaches the multiplayer island at once (lib/server/realtimeNotify).
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, type MemberContext } from "@/lib/server/memberContext";
import { adminContext } from "@/lib/server/adminContext";
import { logModeration, unlogged } from "@/lib/server/moderationLog";
import { notifyRealtime, type RealtimeNotice } from "@/lib/server/realtimeNotify";
import { MUTE_DAYS } from "@/lib/identity/service";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";

const SOURCES = {
  letter: { table: "letters", author: "sender_id", cols: "id, sender_id, recipient_id, subject, body, reported_reason, reported_at" },
  chat: { table: "study_chat_messages", author: "member_id", cols: "id, member_id, reported_by, body, reported_reason, reported_at" },
} as const;
type Row = Record<string, string | null>;
type WorldRow = Row & { context: unknown };

export async function GET() {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const now = ctx.now.toISOString();
  const read = (s: (typeof SOURCES)[keyof typeof SOURCES]) =>
    ctx.db.from(s.table).select(s.cols).eq("reported", true).eq("hidden", false).order("reported_at", { ascending: false }).limit(100);
  const [letters, chat, names, muted, log, world, removed] = await Promise.all([
    read(SOURCES.letter),
    read(SOURCES.chat),
    ctx.db.from("identity_reports").select("id, target_id, reporter_id, reason, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(50),
    ctx.db.from("member_identity").select("member_id").gt("muted_until", now).order("muted_until").limit(100),
    ctx.db.from("moderation_log").select("id, actor_id, action, item_kind, item_id, target_id, excerpt, created_at").order("created_at", { ascending: false }).limit(50),
    ctx.db.from("world_reports").select("id, reporter_id, target_id, line_id, room_id, shard, reason, context, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(100),
    ctx.db.from("member_identity").select("member_id").gt("removed_until", now).order("removed_until").limit(100),
  ]);
  if (letters.error || chat.error || muted.error || log.error) return NextResponse.json({ ok: false, error: "Couldn't load reports." }, { status: 500 });
  const rows = [...((letters.data ?? []) as unknown as Row[]), ...((chat.data ?? []) as unknown as Row[])];
  const logRows = (log.data ?? []) as Row[], mutedIds = ((muted.data ?? []) as Row[]).map((m) => m.member_id);
  const nameRows = (names.data ?? []) as Row[]; // no identity_reports yet: no name reports
  // World chat arrives with 20261003190000_world_chat; before it's applied the queue simply has none.
  const worldRows = world.error ? [] : ((world.data ?? []) as unknown as WorldRow[]);
  const removedIds = removed.error ? [] : ((removed.data ?? []) as Row[]).map((m) => m.member_id);
  const lineIds = worldRows.map((r) => r.line_id).filter((x): x is string => !!x);
  const lines = lineIds.length ? await ctx.db.from("world_chat_messages").select("id, body, area, created_at, hidden").in("id", lineIds) : { data: [] };
  const ids = [...new Set([
    ...rows.flatMap((r) => [r.sender_id, r.recipient_id, r.member_id, r.reported_by]), ...nameRows.flatMap((r) => [r.target_id, r.reporter_id]),
    ...logRows.flatMap((e) => [e.actor_id, e.target_id]), ...mutedIds, ...worldRows.flatMap((r) => [r.target_id, r.reporter_id]), ...removedIds,
  ].filter((x): x is string => !!x))];
  const [profiles, idents] = ids.length
    ? await Promise.all([ctx.db.from("profiles").select("id, display_name").in("id", ids), identities(ctx, ids)])
    : [{ data: [] }, { data: [] }];
  const name = new Map(((profiles.data ?? []) as Row[]).map((p) => [p.id, p.display_name]));
  const ident = new Map(((idents.data ?? []) as Row[]).map((i) => [i.member_id, i]));
  const line = new Map(((lines.data ?? []) as Row[]).map((l) => [l.id, l]));
  const who = (id: string | null) =>
    id ? { id, name: name.get(id) ?? "Member", world_name: ident.get(id)?.world_name ?? null, muted_until: ident.get(id)?.muted_until ?? null, removed_until: ident.get(id)?.removed_until ?? null } : null;
  const view = (r: Row, author: string | null, reporter: string | null) => ({
    id: r.id, body: r.body, subject: r.subject ?? null, reason: r.reported_reason, reported_at: r.reported_at, author: who(author), reporter: who(reporter),
  });
  return NextResponse.json(
    {
      ok: true,
      letters: ((letters.data ?? []) as unknown as Row[]).map((r) => view(r, r.sender_id, r.recipient_id)),
      chat: ((chat.data ?? []) as unknown as Row[]).map((r) => view(r, r.member_id, r.reported_by)),
      world: worldRows.map((r) => {
        const l = r.line_id ? line.get(r.line_id) : undefined;
        return {
          id: r.id, reason: r.reason, created_at: r.created_at, shard: r.shard, room_id: r.room_id,
          line: l ? { id: l.id, body: l.body, area: l.area, created_at: l.created_at, hidden: (l.hidden as unknown) === true } : null,
          context: Array.isArray(r.context) ? r.context : [],
          target: who(r.target_id), reporter: who(r.reporter_id),
        };
      }),
      names: nameRows.map((r) => ({ id: r.id, reason: r.reason, created_at: r.created_at, target: who(r.target_id), reporter: who(r.reporter_id) })),
      muted: mutedIds.map(who),
      removed: removedIds.map(who),
      log: logRows.map((e) => ({ id: e.id, action: e.action, item_kind: e.item_kind, item_id: e.item_id, excerpt: e.excerpt, created_at: e.created_at, actor: who(e.actor_id), target: who(e.target_id) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** World names and sanctions for the queue's people (removed_until from 20261003190000; without it, the rest). */
async function identities(ctx: MemberContext, ids: string[]) {
  const withRemoval = await ctx.db.from("member_identity").select("member_id, world_name, muted_until, removed_until").in("member_id", ids);
  return withRemoval.error ? ctx.db.from("member_identity").select("member_id, world_name, muted_until").in("member_id", ids) : withRemoval;
}

const Body = z.object({ kind: z.enum(["letter", "chat", "world"]), id: z.string().uuid(), action: z.enum(["remove", "remove_mute", "dismiss"]) });
const failed = (error = "Something went wrong. Try again.") => NextResponse.json({ ok: false, error }, { status: 500 });
const closed = () => NextResponse.json({ ok: false, error: "That report is already closed." }, { status: 404 });

/** Mute the author MUTE_DAYS, and tell the island. A Response when the mute didn't save. */
async function mute(ctx: MemberContext, author: string): Promise<{ muted_until: string; realtime: RealtimeNotice } | NextResponse> {
  const muted_until = new Date(ctx.now.getTime() + MUTE_DAYS * 86_400_000).toISOString();
  try { await supabaseIdentityStore(ctx.db).setMute(author, muted_until); }
  catch { return failed("Removed, but the mute didn't save. Try again."); }
  return { muted_until, realtime: await notifyRealtime("/internal/sanction", { member_id: author, muted_until }) };
}

export async function POST(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { kind, id, action } = parsed.data;
  if (kind === "world") return actOnWorldReport(ctx, id, action);
  const s = SOURCES[kind];
  const { data, error } = await ctx.db
    .from(s.table)
    .update(action === "dismiss" ? { reported: false } : { hidden: true })
    .eq("id", id)
    .eq("reported", true)
    .select(`${s.author}, body`);
  if (error) return failed();
  const row = ((data ?? []) as unknown as Row[])[0];
  if (!row) return closed();
  const author = row[s.author];
  let muted: { muted_until: string; realtime: RealtimeNotice } | null = null;
  if (action === "remove_mute" && author) {
    const m = await mute(ctx, author);
    if (m instanceof NextResponse) return m;
    muted = m;
  }
  if (!(await logModeration(ctx.db, ctx.userId, { action, item_kind: kind, item_id: id, target_id: author, excerpt: row.body }))) return unlogged();
  return NextResponse.json({ ok: true, moderation: { kind, id, action, muted_until: muted?.muted_until ?? null, ...(muted ? { realtime: muted.realtime } : {}) } });
}

/**
 * A world chat report: remove hides its line in the log (remove_mute also mutes the player 7 days, in the island at
 * once), dismiss leaves it. Either way the report closes, with any other open reports of the same line.
 */
async function actOnWorldReport(ctx: MemberContext, id: string, action: "remove" | "remove_mute" | "dismiss") {
  const { data: report, error } = await ctx.db.from("world_reports").select("target_id, line_id, reason").eq("id", id).eq("status", "open").maybeSingle();
  if (error) return failed();
  if (!report) return closed();
  const { target_id: target, line_id: lineId, reason } = report as Row;
  let excerpt = reason;
  if (lineId) {
    const q = ctx.db.from("world_chat_messages");
    const { data: lines, error: lineError } = action === "dismiss" ? await q.select("body").eq("id", lineId) : await q.update({ hidden: true }).eq("id", lineId).select("body");
    if (lineError) return failed();
    excerpt = ((lines ?? []) as Row[])[0]?.body ?? reason;
  }
  const resolved = { status: action === "dismiss" ? "dismissed" : "actioned", resolved_at: ctx.now.toISOString(), resolved_by: ctx.userId };
  const { data: closedRows, error: closeError } = await ctx.db.from("world_reports").update(resolved).eq("id", id).eq("status", "open").select("id");
  if (closeError) return failed();
  if (!((closedRows ?? []) as Row[]).length) return closed();
  if (lineId) await ctx.db.from("world_reports").update(resolved).eq("line_id", lineId).eq("status", "open");
  let muted: { muted_until: string; realtime: RealtimeNotice } | null = null;
  if (action === "remove_mute" && target) {
    const m = await mute(ctx, target);
    if (m instanceof NextResponse) return m;
    muted = m;
  }
  if (!(await logModeration(ctx.db, ctx.userId, { action, item_kind: "world_chat", item_id: id, target_id: target, excerpt }))) return unlogged();
  return NextResponse.json({ ok: true, moderation: { kind: "world", id, action, muted_until: muted?.muted_until ?? null, ...(muted ? { realtime: muted.realtime } : {}) } });
}
