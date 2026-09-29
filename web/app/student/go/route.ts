// Account landing ("Log in", and after sign-in). While the member world is closed
// everyone goes to the applicant village. Open: signed-in accounts go to the island
// (phones continue to the companion from there); signed-out people get the applicant
// dashboard's sign-in (Google or email), which sends them back here.
import { NextResponse } from "next/server";
import { APPLICANT_PORTAL, memberWorldIsAvailable } from "@/lib/recruitment-access";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  let path = APPLICANT_PORTAL;
  if (memberWorldIsAvailable()) {
    const user = await createClient().then((s) => s.auth.getUser()).then((r) => r.data.user, () => null);
    path = user ? "/student/dashboard" : "/student/apply/dashboard";
  }
  return NextResponse.redirect(new URL(path, request.url), { headers: { "Cache-Control": "no-store" } });
}
