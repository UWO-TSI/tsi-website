import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM } from "@/lib/resend";
import { trySheetSync } from "@/lib/google-sheets";
import { applicationInput, validatePositionAnswers } from "@/lib/recruitment-validation";
import { isPositionOpen, MAX_RESUME_SIZE_BYTES } from "@/lib/recruitment";
import ApplicationConfirmation from "@/emails/ApplicationConfirmation";

export const maxDuration = 60;

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const RECEIPT_FIELDS = "id,position_id,submitted_at";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = applicationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the required fields, resume and answer lengths." }, { status: 400 });
  const body = parsed.data;
  const findReceipt = () => supabase.from("applications").select(RECEIPT_FIELDS)
    .eq("user_id", user.id).eq("position_id", body.position_id).maybeSingle();
  // A lost response must not turn a saved application into an apparent failure,
  // even if the role closes or its questions change before the applicant retries.
  const existing = await findReceipt();
  if (existing.error) return NextResponse.json({ error: "Could not check whether your application was saved. Please retry or check My applications before starting again." }, { status: 503 });
  if (existing.data) return NextResponse.json({ ...existing.data, already_submitted: true });

  // Rate limit: max 5 submissions per user per minute.
  // Prevents runaway submit-button spam; DB unique constraint
  // already blocks duplicate (user, position) pairs.
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount, error: countError } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("submitted_at", oneMinuteAgo);
  if (countError) return NextResponse.json({ error: "Could not verify your application history. Please try again." }, { status: 503 });
  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Too many submissions. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const { data: position, error: positionError } = await supabase.from("positions").select("*").eq("id", body.position_id).single();
  if (positionError && positionError.code !== "PGRST116") {
    return NextResponse.json({ error: "Could not check this position. Please try again." }, { status: 503 });
  }
  if (!position || !isPositionOpen(position)) {
    return NextResponse.json({ code: "POSITION_CLOSED", error: "This position is not accepting applications. Your draft has not been submitted." }, { status: 409 });
  }
  const answerError = validatePositionAnswers(body, position, user.id);
  if (answerError) return NextResponse.json({ error: answerError }, { status: 400 });

  // Resume path validation. Must be in the user's own folder so a
  // crafted body can't reference someone else's upload.
  let resumeStoragePath: string | null = null;
  let resumeSignedUrl: string | null = null;
  if (body.resume_storage_path) {
    const path = String(body.resume_storage_path);
    if (!path.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "Invalid resume path" },
        { status: 400 }
      );
    }
    resumeStoragePath = path;

    // Generate a 7-day signed URL via service role so it works regardless
    // of the user's session at view time (admins use it too).
    const admin = createAdminClient();
    const { data: file, error: fileError } = await admin.storage.from("resumes").info(path);
    if (fileError || !file) {
      return NextResponse.json({ error: "Resume not found. Please re-upload and try again." }, { status: 400 });
    }
    if (!file.size || file.size > MAX_RESUME_SIZE_BYTES || file.contentType !== "application/pdf") {
      return NextResponse.json({ error: "Please upload a PDF resume no larger than 2 MB." }, { status: 400 });
    }
    const { data: pdf, error: downloadError } = await admin.storage.from("resumes").download(path);
    if (downloadError || !pdf) {
      return NextResponse.json({ error: "Could not verify your resume. Please try again." }, { status: 503 });
    }
    if (!pdf.size || pdf.size > MAX_RESUME_SIZE_BYTES || await pdf.slice(0, 5).text() !== "%PDF-") {
      return NextResponse.json({ error: "Please upload a valid PDF resume no larger than 2 MB." }, { status: 400 });
    }
    const { data: signed, error: signErr } = await admin.storage
      .from("resumes")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      console.error("Resume signed URL error:", signErr);
      return NextResponse.json(
        { error: "Resume not found. Please re-upload and try again." },
        { status: 400 }
      );
    }
    resumeSignedUrl = signed.signedUrl;
  }

  // Path is encoded inside the signed URL (we don't have a separate column),
  // so dashboards extract it and re-sign as needed when the URL expires.
  void resumeStoragePath;

  // Insert application
  const { data, error } = await createAdminClient()
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
      resume_drive_url: resumeSignedUrl,
      resume_filename: body.resume_filename,
      essay_answers: body.essay_answers ?? [],
    })
    .select(RECEIPT_FIELDS)
    .single();

  if (error || !data?.id) {
    // Covers a racing duplicate and an ambiguous database response after commit.
    const recovered = await findReceipt();
    if (!recovered.error && recovered.data) return NextResponse.json({ ...recovered.data, already_submitted: true });
    console.error("Application insert was not confirmed:", error?.code);
    const closed = error?.code === "23514";
    return NextResponse.json({ code: closed ? "POSITION_CLOSED" : "SAVE_UNCONFIRMED", error: closed ? "This position is no longer accepting applications. Your draft has not been submitted." : "We could not confirm your application was saved. Please retry or check My applications before starting again." }, { status: closed ? 409 : 503 });
  }

  // Cleanup cannot delay acknowledgement of a committed application.
  after(async () => { try {
    const { error: draftError } = await supabase
      .from("application_drafts")
      .delete()
      .eq("user_id", user.id)
      .eq("position_id", body.position_id);
    if (draftError) console.error("Draft cleanup failed:", draftError.code);
  } catch (draftErr) {
    console.error("Draft cleanup error:", draftErr);
  } });

  // Once the delivery migration is applied, its trigger queues each save in
  // the same transaction. Deploy this route first; migration backfills the gap.
  after(trySheetSync);

  // Send confirmation after returning the saved application to the applicant.
  after(async () => { try {
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
  } });

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
    .select("*, position:positions!inner(*)")
    .order("submitted_at", { ascending: false }).order("id", { ascending: false });

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

  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? 500);
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    return NextResponse.json({ error: "Invalid page range" }, { status: 400 });
  }
  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}
