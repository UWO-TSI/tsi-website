import { NextResponse } from "next/server";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { resumeNow } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/study/resume: skip the rest of the break.
export async function POST() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await resumeNow(ctx.store, ctx.userId, ctx.now), "study");
}
