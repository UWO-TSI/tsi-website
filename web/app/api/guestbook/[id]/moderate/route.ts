import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/guestbook/[id]/moderate
// T1/T2 only. Body: { hidden: boolean }. Sets the entry's hidden flag.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: { hidden?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.hidden !== "boolean") {
    return NextResponse.json(
      { error: "Body must include `hidden` boolean" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();

  const tier = (profile as { tier: number | null } | null)?.tier ?? 5;
  if (tier > 2) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error: updErr } = await admin
    .from("guestbook_entries")
    .update({ hidden: body.hidden })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json(
      { error: "Failed to update entry" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
