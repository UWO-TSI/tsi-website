import { after, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { npoApplicationInput, npoCycle, npoFormOpen } from "@/lib/npo-applications";
import { copyToSheet, type NpoApplicationRow } from "@/lib/npo-sheet";

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

/** A nonprofit applies for the program (form on /npo). No account needed; saved with the service role. */
export async function POST(request: Request) {
  if (!npoFormOpen()) {
    return NextResponse.json({ error: "Applications are closed. They open again on Aug 10." }, { status: 409 });
  }
  const parsed = npoApplicationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the required fields and try again.", fields: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  }
  const { company_fax, ...body } = parsed.data;
  void company_fax;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (tooMany(`ip:${ip}`, 5)) {
    return NextResponse.json({ error: "Too many submissions. Please wait a few minutes and try again." }, { status: 429 });
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error: countError } = await admin
    .from("npo_applications")
    .select("id", { count: "exact", head: true })
    .eq("contact_email", body.contact_email)
    .gte("created_at", since);
  if (countError) return NextResponse.json({ error: "We couldn't save your application right now. Please try again in a minute." }, { status: 503 });
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: "We already have your application. Email team@tethos.ca if you need to change it." }, { status: 429 });
  }

  const { data, error } = await admin
    .from("npo_applications")
    .insert({ ...body, cycle: npoCycle() })
    .select("id, created_at, cycle, org_name, website, org_type, city, contact_name, contact_email, contact_role, problem, users, current_tools, can_commit, heard_about")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "We couldn't save your application right now. Please try again in a minute." }, { status: 503 });
  }

  after(async () => {
    try { await copyToSheet(data as NpoApplicationRow); } catch (e) { console.error("NPO sheet copy failed:", e); }
  });

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
