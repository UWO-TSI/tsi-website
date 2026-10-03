// Account landing (after sign-in at /student). `?next=` wins when it is a same-origin page other than
// the login itself that is open right now. While the member world is closed that means pages outside it
// (an event's check-in, recruitment, admin); everyone else goes to the applicant village. Open: signed-in
// accounts go to `next`, else the island (phones continue to the companion from there); signed-out people
// get the applicant dashboard's sign-in (Google or email), which sends them back here.
import { NextResponse } from "next/server";
import { APPLICANT_PORTAL, memberWorldIsAvailable, recruitmentRouteRedirect, sameOriginPath } from "@/lib/recruitment-access";
import { createClient } from "@/lib/supabase/server";

// Pages that would bounce straight back here: never a return destination.
const ENTRY = /^\/student(\/(go|login|signup))?\/?$/;

export async function GET(request: Request) {
  const open = memberWorldIsAvailable();
  const next = sameOriginPath(new URL(request.url).searchParams.get("next"));
  const nextPath = next && new URL(next, request.url).pathname;
  const back = next && nextPath && !ENTRY.test(nextPath) && !recruitmentRouteRedirect(nextPath, open) ? next : null;
  let path = back ?? APPLICANT_PORTAL;
  if (open) {
    const user = await createClient().then((s) => s.auth.getUser()).then((r) => r.data.user, () => null);
    path = user ? back ?? "/student/dashboard" : "/student/apply/dashboard";
  }
  return NextResponse.redirect(new URL(path, request.url), { headers: { "Cache-Control": "no-store" } });
}
