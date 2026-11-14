import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";

/**
 * Club admin (tethos.ca/admin): the people on the admin email list (lib/supabase/admin.ts), the same list recruitment
 * uses. Game admin stays on play.tethos.ca, by tier (lib/server/adminContext.ts).
 */
export async function signedInUser(): Promise<User | null> {
  return createClient().then((s) => s.auth.getUser()).then((r) => r.data.user, () => null);
}

/** For club admin API routes: the admin and a service-role client, or the 401/403 to return. */
export async function clubAdmin(): Promise<{ user: User; db: SupabaseClient } | NextResponse> {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!isAdminEmail(user.email ?? "")) return NextResponse.json({ error: "This is for club admins." }, { status: 403 });
  return { user, db: createAdminClient() };
}
