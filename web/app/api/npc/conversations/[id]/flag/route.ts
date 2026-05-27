import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/npc/conversations/[id]/flag
// Marks a single conversation row as flagged for moderation review.
// Only the row's own user (or T1/T2 via RLS) can read it, but the UPDATE
// runs via service role so users without write policies can still report.
// We verify ownership in code before calling the service-role write.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the row belongs to this user via their own RLS-scoped client.
  const { data: row, error: readErr } = await supabase
    .from("npc_conversations")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Service role write — no client UPDATE policy by design.
  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from("npc_conversations")
    .update({ flagged: true })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: "Failed to flag" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
