import { NextResponse } from "next/server";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { tourney } from "@/lib/collections/service";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/collections/tourney: the fishing tourney board (the open one, or the
// last one run). Top half by name; the caller's own row; unnamed neighbours below
// the halfway line (design principle 6, lib/progression/seasonal.ts tourneyBoards).
export async function GET() {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  const goals = await supabaseProgressionStore(ctx.db).listGoals().catch(() => []);
  return jsonResult(await tourney(ctx.store, goals, ctx.userId, ctx.now), "tourney");
}
