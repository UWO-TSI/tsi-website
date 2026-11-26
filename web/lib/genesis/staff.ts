import type { SupabaseClient, User } from "@supabase/supabase-js";

/** GENESIS staff are T1-T3 (the same gate as events and the photo upload, lib/server/adminContext.ts). */
export async function isGenesisStaff(db: SupabaseClient, user: User | null): Promise<boolean> {
  if (!user) return false;
  const { data } = await db.from("profiles").select("tier").eq("id", user.id).maybeSingle();
  return !!data && (data as { tier: number }).tier <= 3;
}
