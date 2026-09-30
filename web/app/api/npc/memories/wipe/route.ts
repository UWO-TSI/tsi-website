import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { adminContext } from "@/lib/server/adminContext";

// POST /api/npc/memories/wipe
// Body: { npc_id: string, user_id?: string }
// Wipes the calling user's memory of an NPC. T1/T2 (adminContext) may pass
// user_id to wipe on behalf of another user (moderation lever on the admin
// NPC conversations page). All deletes happen via service role; no client
// DELETE policy by design.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: { npc_id?: unknown; user_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const npcId = typeof body.npc_id === "string" ? body.npc_id.trim() : "";
  if (!UUID_RE.test(npcId)) {
    return NextResponse.json({ error: "Invalid npc_id" }, { status: 400 });
  }
  const requestedUserId =
    typeof body.user_id === "string" && UUID_RE.test(body.user_id)
      ? body.user_id
      : null;

  const ctx = requestedUserId ? await adminContext() : await memberContext();
  if (ctx instanceof NextResponse) return ctx;

  const { error } = await ctx.db
    .from("npc_memories")
    .delete()
    .eq("npc_id", npcId)
    .eq("user_id", requestedUserId ?? ctx.userId);
  if (error) {
    return NextResponse.json({ error: "Failed to wipe memory" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
