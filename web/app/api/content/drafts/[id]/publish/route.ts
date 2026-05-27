import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_TABLES = new Set(["npc_personas", "shop_items", "seasonal_palettes"]);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.tier !== 1 && profile.tier !== 2)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — T1/T2 only" },
      { status: 403 },
    );
  }

  const { id: draftId } = await params;
  const admin = createAdminClient();

  // 1. Read the draft row
  const { data: draft, error: draftError } = await admin
    .from("content_drafts")
    .select("*")
    .eq("id", draftId)
    .single();

  if (draftError || !draft) {
    return NextResponse.json(
      { ok: false, error: "Draft not found" },
      { status: 404 },
    );
  }

  if (draft.status !== "draft") {
    return NextResponse.json(
      { ok: false, error: `Draft is ${draft.status}, cannot publish` },
      { status: 409 },
    );
  }

  if (!ALLOWED_TABLES.has(draft.table_name)) {
    return NextResponse.json(
      { ok: false, error: "Invalid target table" },
      { status: 400 },
    );
  }

  // 2. Snapshot the current live row (if updating an existing row) for rollback
  if (draft.row_id) {
    const { data: liveRow, error: liveError } = await admin
      .from(draft.table_name)
      .select("*")
      .eq("id", draft.row_id)
      .maybeSingle();

    if (liveError) {
      return NextResponse.json(
        { ok: false, error: `Snapshot read failed: ${liveError.message}` },
        { status: 500 },
      );
    }

    if (liveRow) {
      const { error: snapError } = await admin.from("content_versions").insert({
        table_name: draft.table_name,
        row_id: draft.row_id,
        snapshot_data: liveRow,
        draft_id: draft.id,
        published_by: user.id,
      });
      if (snapError) {
        return NextResponse.json(
          { ok: false, error: `Snapshot insert failed: ${snapError.message}` },
          { status: 500 },
        );
      }
    }
  }

  // 3. UPDATE the live row, or INSERT a new one
  let liveRowId = draft.row_id as string | null;
  if (draft.row_id) {
    const { error: updateError } = await admin
      .from(draft.table_name)
      .update(draft.draft_data)
      .eq("id", draft.row_id);
    if (updateError) {
      return NextResponse.json(
        { ok: false, error: `Live update failed: ${updateError.message}` },
        { status: 500 },
      );
    }
  } else {
    const { data: inserted, error: insertError } = await admin
      .from(draft.table_name)
      .insert(draft.draft_data)
      .select("id")
      .single();
    if (insertError || !inserted) {
      return NextResponse.json(
        { ok: false, error: `Live insert failed: ${insertError?.message ?? "unknown"}` },
        { status: 500 },
      );
    }
    liveRowId = inserted.id as string;
  }

  // 4. Mark the draft as published
  const { error: markError } = await admin
    .from("content_drafts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", draft.id);

  if (markError) {
    return NextResponse.json(
      { ok: false, error: `Draft mark failed: ${markError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, row_id: liveRowId });
}
