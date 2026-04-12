import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { APPLICATION_STATUSES } from "@/lib/recruitment";

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

  // Validate admin_notes if provided
  if (
    body.admin_notes !== undefined &&
    body.admin_notes !== null &&
    typeof body.admin_notes !== "string"
  ) {
    return NextResponse.json(
      { error: "Admin notes must be a string" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const updateData: Record<string, unknown> = {};
  if (body.draft_status !== undefined) updateData.draft_status = body.draft_status;
  if (body.tags !== undefined) updateData.tags = body.tags;
  if (body.admin_notes !== undefined) updateData.admin_notes = body.admin_notes;

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
