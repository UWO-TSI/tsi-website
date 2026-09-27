// Moderation queue (row 221) for reported member text: notes in the letters
// table and study-table chat. Name reports keep /api/identity/moderate.
// T1/T2 remove (hidden: a note stays only in its sender's sent list), remove
// and mute the author 7 days, or dismiss (clear the report, the text stays).
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/server/memberContext";
import { adminContext } from "@/lib/server/adminContext";

const MUTE_DAYS = 7;
const SOURCES = {
  letter: { table: "letters", author: "sender_id", cols: "id, sender_id, recipient_id, subject, body, reported_reason, reported_at" },
  chat: { table: "study_chat_messages", author: "member_id", cols: "id, member_id, reported_by, body, reported_reason, reported_at" },
} as const;
type Row = Record<string, string | null>;

export async function GET() {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const read = (s: (typeof SOURCES)[keyof typeof SOURCES]) =>
    ctx.db.from(s.table).select(s.cols).eq("reported", true).eq("hidden", false).order("reported_at", { ascending: false }).limit(100);
  const [letters, chat] = await Promise.all([read(SOURCES.letter), read(SOURCES.chat)]);
  if (letters.error || chat.error) return NextResponse.json({ ok: false, error: "Couldn't load reports." }, { status: 500 });
  const rows = [...((letters.data ?? []) as unknown as Row[]), ...((chat.data ?? []) as unknown as Row[])];
  const ids = [...new Set(rows.flatMap((r) => [r.sender_id, r.recipient_id, r.member_id, r.reported_by]).filter((x): x is string => !!x))];
  const [profiles, idents] = ids.length
    ? await Promise.all([ctx.db.from("profiles").select("id, display_name").in("id", ids), ctx.db.from("member_identity").select("member_id, world_name, muted_until").in("member_id", ids)])
    : [{ data: [] }, { data: [] }];
  const name = new Map(((profiles.data ?? []) as Row[]).map((p) => [p.id, p.display_name]));
  const ident = new Map(((idents.data ?? []) as Row[]).map((i) => [i.member_id, i]));
  const who = (id: string | null) =>
    id ? { id, name: name.get(id) ?? "Member", world_name: ident.get(id)?.world_name ?? null, muted_until: ident.get(id)?.muted_until ?? null } : null;
  const view = (r: Row, author: string | null, reporter: string | null) => ({
    id: r.id, body: r.body, subject: r.subject ?? null, reason: r.reported_reason, reported_at: r.reported_at, author: who(author), reporter: who(reporter),
  });
  return NextResponse.json(
    {
      ok: true,
      letters: ((letters.data ?? []) as unknown as Row[]).map((r) => view(r, r.sender_id, r.recipient_id)),
      chat: ((chat.data ?? []) as unknown as Row[]).map((r) => view(r, r.member_id, r.reported_by)),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const Body = z.object({ kind: z.enum(["letter", "chat"]), id: z.string().uuid(), action: z.enum(["remove", "remove_mute", "dismiss"]) });

export async function POST(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { kind, id, action } = parsed.data;
  const s = SOURCES[kind];
  const { data, error } = await ctx.db
    .from(s.table)
    .update(action === "dismiss" ? { reported: false } : { hidden: true })
    .eq("id", id)
    .eq("reported", true)
    .select(s.author);
  if (error) return NextResponse.json({ ok: false, error: "Something went wrong. Try again." }, { status: 500 });
  const row = ((data ?? []) as unknown as Row[])[0];
  if (!row) return NextResponse.json({ ok: false, error: "That report is already closed." }, { status: 404 });
  const author = row[s.author];
  let muted_until: string | null = null;
  if (action === "remove_mute" && author) {
    muted_until = new Date(ctx.now.getTime() + MUTE_DAYS * 86_400_000).toISOString();
    const { error: muteError } = await ctx.db.from("member_identity").upsert({ member_id: author, muted_until }, { onConflict: "member_id" });
    if (muteError) return NextResponse.json({ ok: false, error: "Removed, but the mute didn't save. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, moderation: { kind, id, action, muted_until } });
}
