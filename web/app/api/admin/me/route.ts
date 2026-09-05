// Is the current session an admin? Lets client nav show the admin link.
// The whitelist itself never leaves the server.

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
    { isAdmin },
    { headers: { "Cache-Control": "no-store" } }
  );
}
