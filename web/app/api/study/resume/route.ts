import { NextResponse } from "next/server";
import { studyContext } from "@/lib/study/deps";
import { resumeNow } from "@/lib/study/service";
import { jsonResult } from "@/lib/server/memberContext";

// POST /api/study/resume: skip the rest of the break.
export async function POST() {
  const ctx = await studyContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await resumeNow(ctx.store, ctx.userId, ctx.now), "study");
}
