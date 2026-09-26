import { NextResponse } from "next/server";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { goalViews, storeFailure } from "@/lib/progression/service";
import { syncGoalsThrottled } from "@/lib/progression/sync";

// GET /api/progression/goals: active club goals with club-wide progress and the caller's own share.
export async function GET() {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  try {
    await syncGoalsThrottled(ctx.store, ctx.now).catch(() => undefined);
    const goals = await ctx.store.listGoals();
    const views = await goalViews(ctx.store, goals, ctx.userId, ctx.now);
    return NextResponse.json({ ok: true, goals: views });
  } catch (err) {
    return jsonResult(storeFailure(err), "");
  }
}
