import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { APPLICATION_STATUSES } from "@/lib/recruitment";
import {
  parseAdminNotes,
  serializeAdminNotes,
  upsertAdminNote,
} from "@/lib/admin-notes";

// Admin-only GET: returns a single application with joined position +
// status_releases. Used by the admin preview page to render what a
// specific student sees on their dashboard.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applications")
    .select(
      "*, position:positions(*), releases:status_releases(id, old_status, new_status, released_at)"
    )
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Validate draft_status if provided
  if (
    body.draft_status !== undefined &&
    body.draft_status !== null &&
    !APPLICATION_STATUSES.includes(body.draft_status)
  ) {
    return NextResponse.json(
      { error: `Invalid status: ${body.draft_status}` },
      { status: 400 }
    );
  }

  // Validate tags if provided
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    return NextResponse.json(
      { error: "Tags must be an array" },
      { status: 400 }
    );
  }

  // Validate note_text if provided (per-admin note upsert)
  if (body.note_text !== undefined && typeof body.note_text !== "string") {
    return NextResponse.json(
      { error: "Note text must be a string" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const updateData: Record<string, unknown> = {};
  if (body.draft_status !== undefined) updateData.draft_status = body.draft_status;
  if (body.tags !== undefined) updateData.tags = body.tags;

  // Per-admin notes: fetch current, replace/remove this admin's entry,
  // serialize back. Atomicity is fine because admins rarely collide on
  // the same applicant, and worst case is a last-write-wins on one note.
  if (body.note_text !== undefined) {
    const { data: current } = await admin
      .from("applications")
      .select("admin_notes")
      .eq("id", id)
      .single();
    const notes = parseAdminNotes(current?.admin_notes);
    const next = upsertAdminNote(
      notes,
      (user.email ?? "").toLowerCase(),
      (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.display_name as string | undefined),
      body.note_text
    );
    updateData.admin_notes = serializeAdminNotes(next);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const { data, error } = await admin
    .from("applications")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Best-effort: also remove the resume blob if we can parse a path
  // out of the stored signed URL. Failures here don't block the row delete.
  const { data: row } = await admin
    .from("applications")
    .select("resume_drive_url")
    .eq("id", id)
    .single();

  if (row?.resume_drive_url) {
    const match = row.resume_drive_url.match(
      /\/object\/sign\/resumes\/([^?]+)/
    );
    if (match?.[1]) {
      await admin.storage.from("resumes").remove([decodeURIComponent(match[1])]);
    }
  }

  const { error } = await admin.from("applications").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
