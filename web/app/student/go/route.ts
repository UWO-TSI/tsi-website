// Account landing (after sign-in at /student). While the member world is closed
// everyone goes to the applicant village. Open: signed-in accounts go to `?next=` when it is
// a same-origin page other than the login itself, else the island (phones continue to the
// companion from there); signed-out people get the applicant dashboard's sign-in (Google or
// email), which sends them back here.
import { NextResponse } from "next/server";
import { APPLICANT_PORTAL, memberWorldIsAvailable, sameOriginPath } from "@/lib/recruitment-access";
import { createClient } from "@/lib/supabase/server";

// Pages that would bounce straight back here: never a return destination.
const ENTRY = /^\/student(\/(go|login|signup))?\/?$/;

export async function GET(request: Request) {
  let path = APPLICANT_PORTAL;
  if (memberWorldIsAvailable()) {
    const user = await createClient().then((s) => s.auth.getUser()).then((r) => r.data.user, () => null);
    const next = sameOriginPath(new URL(request.url).searchParams.get("next"));
    const back = next && !ENTRY.test(new URL(next, request.url).pathname) ? next : null;
    path = user ? back ?? "/student/dashboard" : "/student/apply/dashboard";
  }
  return NextResponse.redirect(new URL(path, request.url), { headers: { "Cache-Control": "no-store" } });
}
