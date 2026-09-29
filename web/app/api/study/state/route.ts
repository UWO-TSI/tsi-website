import { NextResponse } from "next/server";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { getState } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/study/state: your session (phase, remaining), your table's seat-mates, all tables with occupancy.
export async function GET() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await getState(ctx.store, ctx.userId, ctx.now), "study");
}
