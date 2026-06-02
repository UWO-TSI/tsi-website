import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const SubmissionSchema = z.object({
  submission_text: z.string().min(1).max(5000),
  attachment_urls: z.array(z.string().url().max(500)).max(10).optional().default([]),
});

// GET /api/bounties/[id]/submit
// Returns the current user's submissions on this bounty (newest first) so the
// claim UI can show pending/approved/revision_requested status + reviewer
// notes. Empty array when none exist.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const { data, error } = await supabase
    .from("bounty_submissions")
    .select("*")
    .eq("bounty_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify user has an active claim on this bounty
  const { data: claim } = await supabase
    .from("bounty_claims")
    .select("id, status")
    .eq("bounty_id", id)
    .eq("user_id", user.id)
    .single();

  if (!claim || claim.status !== "active") {
    return NextResponse.json(
      { error: "You must have an active claim to submit" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("bounty_submissions")
    .insert({
      bounty_id: id,
      user_id: user.id,
      submission_text: parsed.data.submission_text,
      attachment_urls: parsed.data.attachment_urls,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update bounty status to review
  await supabase
    .from("bounties")
    .update({ status: "review", updated_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ submission: data }, { status: 201 });
}
