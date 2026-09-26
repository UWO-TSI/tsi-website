import { NextResponse } from "next/server";
import { progressionContext } from "@/lib/progression/deps";
import { goalViews, storeFailure } from "@/lib/progression/service";
import { syncGoalsThrottled } from "@/lib/progression/sync";

// GET /api/progression/goals: active club goals with club-wide progress and the caller's own share.
export async function GET() {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  try {
    await syncGoalsThrottled(ctx.store, ctx.now).catch(() => undefined);
    const goals = await ctx.store.listGoals();
    const views = await goalViews(ctx.store, goals, ctx.userId, ctx.now);
    return NextResponse.json({ ok: true, goals: views });
  } catch (err) {
    const f = storeFailure(err);
    return NextResponse.json({ ok: false, error: f.error, code: f.code }, { status: f.status });
  }
}
