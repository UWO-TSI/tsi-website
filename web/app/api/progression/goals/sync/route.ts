import { NextResponse } from "next/server";
import { isAdminTier, progressionContext } from "@/lib/progression/deps";
import { forbidden } from "@/lib/progression/http";
import { storeFailure } from "@/lib/progression/service";
import { syncGoalsThrottled } from "@/lib/progression/sync";

// POST /api/progression/goals/sync (T1/T2): credit new check-ins/bounties now.
export async function POST() {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!isAdminTier(ctx.tier)) return forbidden();
  try {
    return NextResponse.json({ ok: true, ...(await syncGoalsThrottled(ctx.store, ctx.now, true)) });
  } catch (err) {
    const f = storeFailure(err);
    return NextResponse.json({ ok: false, error: f.error, code: f.code }, { status: f.status });
  }
}
