import { NextResponse } from "next/server";
import { studyContext } from "@/lib/study/deps";
import { beat } from "@/lib/study/service";
import { jsonResult } from "@/lib/server/memberContext";

// POST /api/study/heartbeat: still here; the server advances phases and applies the 5-minute grace.
export async function POST() {
  const ctx = await studyContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await beat(ctx.store, ctx.userId, ctx.now), "study");
}
