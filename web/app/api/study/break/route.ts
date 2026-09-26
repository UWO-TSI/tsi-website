import { NextResponse } from "next/server";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { breakNow } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/study/break: take the break now (minutes kept, block bonus dropped).
export async function POST() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await breakNow(ctx.store, ctx.userId, ctx.now), "study");
}
