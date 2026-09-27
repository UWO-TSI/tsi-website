import { NextResponse } from "next/server";
import { adminContext } from "@/lib/server/adminContext";

// POST /api/npc/conversations/[id]/resolve
// T1/T2 moderation: unflag a conversation (sets flagged=false) after review.
// RLS lets T1/T2 SELECT all rows; UPDATE runs via service role.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const admin = ctx.db;
  const { error: updErr } = await admin
    .from("npc_conversations")
    .update({ flagged: false })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: "Failed to resolve" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
