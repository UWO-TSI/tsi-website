import { NextResponse } from "next/server";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { beat } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/study/heartbeat: still here; the server advances phases and applies the 5-minute grace.
export async function POST() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await beat(ctx.store, ctx.userId, ctx.now), "study");
}
