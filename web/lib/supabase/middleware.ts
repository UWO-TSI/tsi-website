import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  // Admin election results — allow T1/T2 through, everyone else blocked
  if (pathname.startsWith("/student/dashboard/admin/election")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    if (!profile || profile.tier > 2) {
      const url = request.nextUrl.clone();
      url.pathname = "/under-construction";
      return NextResponse.redirect(url);
    }

    // T1/T2 admin — allow through
    return supabaseResponse;
  }

  // All other dashboard routes → under construction
  if (pathname.startsWith("/student/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/under-construction";
    return NextResponse.redirect(url);
  }

  // Onboarding → redirect to election
  if (pathname.startsWith("/student/onboarding")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/student/election";
    return NextResponse.redirect(url);
  }

  // Election route
  if (pathname === "/student/election") {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("has_voted")
      .eq("id", user.id)
      .single();

    // Already voted → under construction
    if (profile?.has_voted === true) {
      const url = request.nextUrl.clone();
      url.pathname = "/under-construction";
      return NextResponse.redirect(url);
    }
  }

  // Already logged in — redirect away from login/signup
  if (
    (pathname === "/student/login" || pathname === "/student/signup") &&
    user
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("has_voted")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    if (profile?.has_voted === true) {
      url.pathname = "/under-construction";
    } else {
      url.pathname = "/student/election";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
