import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM } from "@/lib/resend";
import { syncApplicationToSheet } from "@/lib/google-sheets";
import ApplicationConfirmation from "@/emails/ApplicationConfirmation";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: max 3 submissions per user per minute.
  // Prevents runaway submit-button spam; DB unique constraint
  // already blocks duplicate (user, position) pairs.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("submitted_at", oneMinuteAgo);
  if ((recentCount ?? 0) >= 3) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await request.json();

  // Validate required fields
  const required = [
    "position_id",
    "full_name",
    "email",
    "phone",
    "program_major",
    "year_of_study",
    "heard_about_us",
  ];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  // Insert application
  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      position_id: body.position_id,
      full_name: body.full_name,
      email: body.email,
      phone: body.phone,
      program_major: body.program_major,
      year_of_study: body.year_of_study,
      linkedin_url: body.linkedin_url,
      heard_about_us: body.heard_about_us,
      resume_drive_url: body.resume_drive_url,
      resume_filename: body.resume_filename,
      essay_answers: body.essay_answers ?? [],
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You have already applied for this position" },
        { status: 409 }
      );
    }
    console.error("Application insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get position for email + sheet sync
  const { data: position } = await supabase
    .from("positions")
    .select("*")
    .eq("id", body.position_id)
    .single();

  // Clean up draft (non-blocking)
  try {
    await supabase
      .from("application_drafts")
      .delete()
      .eq("user_id", user.id)
      .eq("position_id", body.position_id);
  } catch (draftErr) {
    console.error("Draft cleanup error:", draftErr);
  }

  // Sync to Google Sheet (non-blocking)
  try {
    if (position) {
      await syncApplicationToSheet(
        { ...data, tags: data.tags ?? [] },
        position
      );
    }
  } catch (sheetErr) {
    console.error("Sheet sync error:", sheetErr);
  }

  // Send confirmation email (non-blocking)
  try {
    const resend = getResend();
    await resend.emails.send({
      from: EMAIL_FROM,
      to: body.email,
      subject: `Application Received: ${position?.title ?? "Tethos"}`,
      react: ApplicationConfirmation({
        applicantName: body.full_name,
        positionTitle: position?.title ?? "Position",
        dashboardUrl: `${new URL(request.url).origin}/student/apply/dashboard`,
      }),
    });
  } catch (emailErr) {
    console.error("Email send error:", emailErr);
    // Don't fail the submission if email fails
  }

  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin check
  if (!isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");

  const admin = createAdminClient();
  let query = admin
    .from("applications")
    .select("*, position:positions(*)")
    .order("submitted_at", { ascending: false });

  if (role) {
    // Filter by position slug via join
    query = query.eq("position.slug", role);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
