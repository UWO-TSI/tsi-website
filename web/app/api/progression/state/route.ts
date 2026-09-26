import { NextResponse } from "next/server";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { loadState } from "@/lib/progression/service";
import { syncGoalsThrottled } from "@/lib/progression/sync";

// GET /api/progression/state: chapters, goals, objective line, regions, unread letters.
export async function GET() {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  try {
    await syncGoalsThrottled(ctx.store, ctx.now);
  } catch {
    // Real-activity credit is best-effort on read; state still loads.
  }
  return jsonResult(await loadState(ctx.store, ctx.userId, ctx.now), "state");
}
