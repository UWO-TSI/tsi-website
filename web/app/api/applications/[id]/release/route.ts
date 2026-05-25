import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM } from "@/lib/resend";
import StatusUpdate from "@/emails/StatusUpdate";

export async function POST(
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

  const admin = createAdminClient();

  // Get current application
  const { data: app, error: fetchErr } = await admin
    .from("applications")
    .select("*, position:positions(title)")
    .eq("id", id)
    .single();

  if (fetchErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (!app.draft_status || app.draft_status === app.status) {
    return NextResponse.json(
      { error: "No pending status change to release" },
      { status: 400 }
    );
  }

  const oldStatus = app.status;
  const newStatus = app.draft_status;

  // Update status and clear draft
  const { error: updateErr } = await admin
    .from("applications")
    .update({
      status: newStatus,
      draft_status: null,
      released_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Audit log
  await admin.from("status_releases").insert({
    application_id: id,
    old_status: oldStatus,
    new_status: newStatus,
    released_by: user.id,
  });

  // Send status update email (non-blocking).
  // Disabled unless RECRUITMENT_EMAILS_ENABLED=true so admins can iterate
  // on the flow without spamming applicants with test releases.
  if (process.env.RECRUITMENT_EMAILS_ENABLED === "true") {
    try {
      const resend = getResend();
      const positionTitle = app.position?.title ?? "Position";
      await resend.emails.send({
        from: EMAIL_FROM,
        to: app.email,
        subject: `Application Update: ${positionTitle}`,
        react: StatusUpdate({
          applicantName: app.full_name,
          positionTitle,
          newStatus,
          statusMessage: "",
          dashboardUrl: `${new URL(request.url).origin}/student/apply/dashboard`,
        }),
      });
    } catch (emailErr) {
      console.error("Status email error:", emailErr);
    }
  }

  return NextResponse.json({ released: true, oldStatus, newStatus });
}
