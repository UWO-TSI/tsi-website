import { APPLICANT_PORTAL } from "@/lib/recruitment-access";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Signed out: the sign-in entry, back to this page after (/student/go honours `next`). */
function toSignIn(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/student";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    return supabaseResponse;
  }

  const { pathname } = request.nextUrl;

  // ─── Election routes (archived behind env flag) ───────────────────────
  if (pathname === "/student/election" || pathname.startsWith("/student/dashboard/admin/election")) {
    if (process.env.ENABLE_ELECTION !== "true") {
      const url = request.nextUrl.clone();
      url.pathname = APPLICANT_PORTAL;
      return NextResponse.redirect(url);
    }

    // Election enabled — require auth
    if (!user) return toSignIn(request);

    // Admin election results — T1/T2 only
    if (pathname.startsWith("/student/dashboard/admin/election")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();

      if (!profile || profile.tier > 2) {
        const url = request.nextUrl.clone();
        url.pathname = "/student/dashboard";
        return NextResponse.redirect(url);
      }
    }

    return supabaseResponse;
  }

  // ─── Dashboard admin routes — require T1-T3 ──────────────────────────
  if (pathname.startsWith("/student/dashboard/admin")) {
    if (!user) return toSignIn(request);

    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, onboarding_completed")
      .eq("id", user.id)
      .single();

    if (!profile || profile.tier > 3) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/dashboard";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // ─── Dashboard routes — require auth; portal pages require onboarding ─
  if (pathname.startsWith("/student/dashboard")) {
    if (!user) return toSignIn(request);

    // The island itself skips the portal profile wizard: game players name
    // themselves in the character creator (hud-first-login §6, row 211).
    if (pathname.replace(/\/+$/, "") === "/student/dashboard") return supabaseResponse;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile && !profile.onboarding_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/onboarding";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // ─── Onboarding — require auth, skip if already completed ─────────────
  if (pathname.startsWith("/student/onboarding")) {
    if (!user) return toSignIn(request);

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile && profile.onboarding_completed) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/dashboard";
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // ─── Already logged in — redirect away from login (/student) and signup ─
  if (
    (pathname.replace(/\/+$/, "") === "/student" || pathname === "/student/signup") &&
    user
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/student/go";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
