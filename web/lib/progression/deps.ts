/**
 * Request dependencies for /api/progression/* (mocked in route tests).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseProgressionStore } from "./supabaseStore";
import type { ProgressionStore } from "./store";

export interface ProgressionContext {
  userId: string;
  tier: number;
  store: ProgressionStore;
  now: Date;
}

/** Resolve the signed-in member + a service-role store, or an error response. */
export async function progressionContext(): Promise<ProgressionContext | NextResponse> {
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
    return NextResponse.json({ ok: false, error: "Progression isn't available yet.", code: "unavailable" }, { status: 503 });
  }
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ ok: false, error: "Progression isn't available yet.", code: "unavailable" }, { status: 503 });
  }
  return { userId, tier, store: supabaseProgressionStore(createAdminClient()), now: new Date() };
}

export function isAdminTier(tier: number): boolean {
  return tier === 1 || tier === 2;
}
