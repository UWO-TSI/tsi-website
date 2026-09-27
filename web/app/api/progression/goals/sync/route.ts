import { NextResponse } from "next/server";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { jsonResult } from "@/lib/server/memberContext";
import { withAdminStore } from "@/lib/server/adminContext";
import { storeFailure } from "@/lib/progression/service";
import { syncGoalsThrottled } from "@/lib/progression/sync";

// POST /api/progression/goals/sync (T1/T2): credit new check-ins/bounties now.
export async function POST() {
  const ctx = await withAdminStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ ok: true, ...(await syncGoalsThrottled(ctx.store, ctx.now, true)) });
  } catch (err) {
    return jsonResult(storeFailure(err), "");
  }
}
