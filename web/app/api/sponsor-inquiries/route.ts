import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_FROM, getResend } from "@/lib/resend";
import { isPreviewDeployment } from "@/lib/npo-applications";
import { inquiryEmail, SPONSORSHIP_LEADS, sponsorInquiryInput } from "@/lib/sponsor-inquiries";

// Per-instance burst guard; the database check below covers repeat submissions across instances.
const recent = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;

function tooMany(key: string, limit: number) {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) recent.clear();
  return hits.length > limit;
}

const UNAVAILABLE = "We couldn't send that right now. Please try again in a minute, or email jgao537@uwo.ca.";

/** A sponsor leaves their details (form on /genesis). Saved with the service role, then the leads get an email. */
export async function POST(request: Request) {
  const parsed = sponsorInquiryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the required fields and try again.", fields: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  }
  const { company_fax, ...body } = parsed.data;
  void company_fax;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(`ip:${ip}`, 5)) {
    return NextResponse.json({ error: "Too many submissions. Please wait a few minutes and try again." }, { status: 429 });
  }

  let admin;
  try { admin = createAdminClient(); } catch { return NextResponse.json({ error: UNAVAILABLE }, { status: 503 }); }
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error: countError } = await admin
    .from("sponsor_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("email", body.email)
    .gte("created_at", since);
  if (countError) return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "We already have your details and will be in touch." }, { status: 429 });
  }

  const preview = isPreviewDeployment();
  const { data, error } = await admin.from("sponsor_inquiries").insert({ ...body, preview }).select("id").single();
  if (error || !data) return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });

  if (!preview && process.env.RESEND_API_KEY) {
    after(async () => {
      try {
        const mail = inquiryEmail(body);
        await getResend().emails.send({ from: EMAIL_FROM, to: SPONSORSHIP_LEADS, replyTo: body.email, subject: mail.subject, text: mail.text });
        await admin.from("sponsor_inquiries").update({ notified_at: new Date().toISOString() }).eq("id", data.id);
      } catch (e) {
        console.error("Sponsor inquiry email failed:", e);
      }
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
