import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/npc/conversations?npc_id=<uuid>&limit=10
// Returns the current user's recent turns with this NPC, oldest first.
// RLS (migration 018) restricts to own rows; we still gate on auth.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const npcId = (url.searchParams.get("npc_id") ?? "").trim();
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "10", 10);
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 10));

  if (!UUID_RE.test(npcId)) {
    return NextResponse.json({ error: "Invalid npc_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("npc_conversations")
    .select("id, user_message, npc_response, flagged, created_at")
    .eq("npc_id", npcId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 });
  }

  // Return oldest-first so the UI can append without reversing.
  return NextResponse.json({ turns: (data ?? []).reverse() });
}
