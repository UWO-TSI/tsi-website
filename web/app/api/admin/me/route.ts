// Who is the current session? Lets client nav show "My applications" vs
// "Log in" and the admin link. The whitelist itself never leaves the server.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = !!user && isAdminEmail(user.email ?? "");
  return NextResponse.json(
    { signedIn: !!user, isAdmin },
    { headers: { "Cache-Control": "no-store" } }
  );
}
