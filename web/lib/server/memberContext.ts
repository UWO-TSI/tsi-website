/**
 * Signed-in member + service-role client for game-data routes (homes,
 * collections). Mocked in route tests.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MemberContext {
  userId: string;
  tier: number;
  db: SupabaseClient;
  now: Date;
}

export async function memberContext(): Promise<MemberContext | NextResponse> {
  let userId: string | null = null;
  let tier = 5;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
    if (userId) {
      const { data: profile } = await supabase.from("profiles").select("tier").eq("id", userId).maybeSingle();
      if (profile && typeof profile.tier === "number") tier = profile.tier;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  }
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  }
  return { userId, tier, db: createAdminClient(), now: new Date() };
}

export function jsonResult<T>(r: { ok: true; data: T } | { ok: false; status: number; error: string; code?: string; [k: string]: unknown }, key: string): NextResponse {
  if (!r.ok) {
    const { ok: _ok, status, ...rest } = r;
    void _ok;
    return NextResponse.json({ ok: false, ...rest }, { status });
  }
  return NextResponse.json({ ok: true, [key]: r.data });
}
