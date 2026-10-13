import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { verifyInvite } from "@/app/finalround/token";
import { EVENTS, progressId, type ProgressEvent } from "@/app/finalround/progress";
import { ONBOARDING } from "@/app/finalround/data";
import FinalRoundWelcome from "@/emails/FinalRoundWelcome";

const FROM = "Tech for Social Impact <noreply@tethos.ca>";
const REPLY_TO = "dliu468@uwo.ca";

// "11:59 PM ET tonight (Wed, Oct 8)", in Toronto time.
function deadlineToday() {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
  return `11:59 PM ET tonight (${day})`;
}

async function sendFollowup(id: string) {
  if (process.env.FINALROUND_EMAILS_ENABLED !== "true") return;
  const db = createAdminClient();
  // Claim the row first so a reload or a second device never sends twice.
  const { data, error: claimError } = await db
    .from("finalround_progress")
    .update({ followup_sent_at: new Date().toISOString() })
    .eq("id", id)
    .is("followup_sent_at", null)
    .not("email", "is", null)
    .select("name, project, email, cc")
    .maybeSingle();
  if (claimError) console.error("finalround followup claim failed", claimError);
  if (!data?.email) return;

  let error: unknown = null;
  try {
    ({ error } = await getResend().emails.send({
      from: FROM,
      to: data.email,
      cc: data.cc ?? [],
      replyTo: REPLY_TO,
      subject: "Welcome to Tech for Social Impact: confirm your spot today",
      react: FinalRoundWelcome({
        firstName: data.name.split(" ")[0],
        project: data.project === "External Team" ? "External" : data.project,
        deadline: deadlineToday(),
        steps: ONBOARDING,
      }),
    }));
  } catch (e) {
    error = e;
  }
  // Release the claim if the send failed, so the next visit retries.
  if (error) {
    console.error("finalround followup send failed", error);
    await db.from("finalround_progress").update({ followup_sent_at: null }).eq("id", id);
  }
}

export async function POST(req: Request) {
  const { token, event } = (await req.json().catch(() => ({}))) as { token?: string; event?: string };
  const invite = typeof token === "string" ? verifyInvite(token) : null;
  if (!invite || !EVENTS.includes(event as ProgressEvent)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const id = progressId(token!);
  const { error } = await createAdminClient().rpc("finalround_track", {
    p_id: id,
    p_name: invite.name,
    p_project: invite.project,
    p_event: event,
  });
  if (event === "reveal") after(() => sendFollowup(id).catch((e) => console.error("finalround followup", e)));
  return NextResponse.json({ ok: !error });
}
