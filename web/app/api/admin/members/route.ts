// T1/T2 member list for /student/dashboard/admin/members. email and
// last_login_at are service-role-only columns (migration 20260926120000), so
// the list is read server-side after checking the caller's tier.

import { NextResponse } from "next/server";
import { adminContext } from "@/lib/server/adminContext";

export async function GET() {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.db
    .from("profiles")
    .select(
      "id, display_name, email, tier, membership, position, class, level, xp, tethos_coins, is_active, is_alumni, onboarding_completed, created_at, last_login_at"
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
