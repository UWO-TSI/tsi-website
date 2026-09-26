import { NextResponse } from "next/server";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { forbidden, isAdminTier, jsonResult, withStore } from "@/lib/server/memberContext";
import { storeFailure } from "@/lib/progression/service";
import { syncGoalsThrottled } from "@/lib/progression/sync";

// POST /api/progression/goals/sync (T1/T2): credit new check-ins/bounties now.
export async function POST() {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  if (!isAdminTier(ctx.tier)) return forbidden();
  try {
    return NextResponse.json({ ok: true, ...(await syncGoalsThrottled(ctx.store, ctx.now, true)) });
  } catch (err) {
    return jsonResult(storeFailure(err), "");
  }
}
