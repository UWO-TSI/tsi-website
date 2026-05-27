import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/npc/memories/wipe
// Body: { npc_id: string, user_id?: string }
// Wipes the calling user's memory of an NPC. T1 admins may pass user_id to
// wipe on behalf of another user (moderation lever from D6 admin page).
// All deletes happen via service role; no client DELETE policy by design.

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let targetUserId = user.id;
  if (requestedUserId && requestedUserId !== user.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .maybeSingle();
    const tier = (profile?.tier as number | undefined) ?? 5;
    if (tier !== 1) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    targetUserId = requestedUserId;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("npc_memories")
    .delete()
    .eq("npc_id", npcId)
    .eq("user_id", targetUserId);
  if (error) {
    return NextResponse.json({ error: "Failed to wipe memory" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
