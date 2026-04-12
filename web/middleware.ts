import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
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
