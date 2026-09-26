// T1/T2 member list for /student/dashboard/admin/members. email and
// last_login_at are service-role-only columns (migration 20260926120000), so
// the list is read server-side after checking the caller's tier.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();
  if (!me || me.tier > 2) {
    return NextResponse.json({ error: "Forbidden — T1-T2 only" }, { status: 403 });
  }

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select(
      "id, display_name, email, tier, position, class, level, xp, tethos_coins, is_active, is_alumni, onboarding_completed, created_at, last_login_at"
    )
    .order("tier", { ascending: true })
    .order("display_name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { members: data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
