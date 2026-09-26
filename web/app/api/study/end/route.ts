import { NextResponse } from "next/server";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { endNow } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/study/end: leave the seat; settles minutes and bonus once.
export async function POST() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await endNow(ctx.store, ctx.userId, ctx.now), "study");
}
