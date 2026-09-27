import { NextResponse } from "next/server";
import { adminContext } from "@/lib/server/adminContext";
import { CONTENT_TABLES } from "@/lib/content/drafts";

// POST — publish a draft (T1/T2): snapshot the live row into content_versions
// (rollback + activity log), then update it or insert the new row.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;

  const { id: draftId } = await params;
  const admin = ctx.db;

  // 1. Read the draft row
  const { data: draft, error: draftError } = await admin
    .from("content_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();

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

  if (!CONTENT_TABLES.has(draft.table_name)) {
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
        published_by: ctx.userId,
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
