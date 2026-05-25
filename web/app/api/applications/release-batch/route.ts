import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { getResend, EMAIL_FROM } from "@/lib/resend";
import StatusUpdate from "@/emails/StatusUpdate";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { position_id, application_ids } = body as {
    position_id?: string;
    application_ids?: string[];
  };

  const admin = createAdminClient();

  // Get applications with pending draft status
  let query = admin
    .from("applications")
    .select("*, position:positions(title)")
    .not("draft_status", "is", null);

  if (position_id) {
    query = query.eq("position_id", position_id);
  } else if (application_ids?.length) {
    query = query.in("id", application_ids);
  } else {
    return NextResponse.json(
      { error: "Provide position_id or application_ids" },
      { status: 400 }
    );
  }

  const { data: apps, error: fetchErr } = await query;

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!apps?.length) {
    return NextResponse.json({ released: 0 });
  }

  // Filter to only those with actual changes
  const toRelease = apps.filter(
    (a) => a.draft_status && a.draft_status !== a.status
  );

  let released = 0;
  const resend = getResend();
  const origin = new URL(request.url).origin;

  for (const app of toRelease) {
    const oldStatus = app.status;
    const newStatus = app.draft_status!;

    // Update
    const { error } = await admin
      .from("applications")
      .update({
        status: newStatus,
        draft_status: null,
        released_at: new Date().toISOString(),
      })
      .eq("id", app.id);

    if (error) continue;

    // Audit log
    await admin.from("status_releases").insert({
      application_id: app.id,
      old_status: oldStatus,
      new_status: newStatus,
      released_by: user.id,
    });

    // Email — gated behind RECRUITMENT_EMAILS_ENABLED so test releases
    // don't notify real applicants while admins iterate.
    if (process.env.RECRUITMENT_EMAILS_ENABLED === "true") {
      try {
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
            dashboardUrl: `${origin}/student/apply/dashboard`,
          }),
        });
      } catch {
        // Continue even if email fails
      }
    }

    released++;
  }

  return NextResponse.json({ released });
}
