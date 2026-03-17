import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected dashboard routes — require auth
  if (pathname.startsWith("/student/dashboard")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      return NextResponse.redirect(url);
    }

    // Check if onboarding is complete (via profile)
    if (!pathname.startsWith("/student/onboarding")) {
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
    }
  }

  // Onboarding route — require auth
  if (pathname.startsWith("/student/onboarding")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      return NextResponse.redirect(url);
    }
  }

  // Already logged in — redirect away from login/signup
  if (
    (pathname === "/student/login" || pathname === "/student/signup") &&
    user
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/student/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
