import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Fail-open deadline for the session refresh. During the 2026-07-02 Supabase
// outage (project DNS gone), supabase-js retried the dead endpoint inside
// updateSession until Vercel killed the invocation at 25s — every matched
// route 504'd, marketing pages included. If auth can't answer in 4s, serve
// the request without a session instead: same degradation path as the
// missing-env-vars branch in updateSession. Data stays protected by RLS and
// per-route API auth; only the middleware redirects are skipped.
const SESSION_TIMEOUT_MS = 4000;

export async function middleware(request: NextRequest) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failOpen = new Promise<NextResponse>((resolve) => {
    timer = setTimeout(
      () => resolve(NextResponse.next({ request })),
      SESSION_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([updateSession(request), failOpen]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const config = {
  matcher: [
    "/student/dashboard/:path*",
    "/student/login",
    "/student/signup",
    "/student/onboarding/:path*",
    "/student/election",
    "/student/apply/:path*",
    "/admin/:path*",
  ],
};
