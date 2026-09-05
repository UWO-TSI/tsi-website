// Role-aware landing after "Log in" (David, 2026-09-05): admins go to the
// game portal (which carries the recruitment board under Admin), everyone
// else to the applicant dashboard. Signed out: the applicant dashboard shows
// the sign-in prompt and sends people back here afterwards.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const url = new URL(request.url);
  url.search = "";
  url.pathname =
    user && isAdminEmail(user.email ?? "")
      ? "/student/dashboard"
      : "/student/apply/dashboard";
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
