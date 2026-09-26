import { NextResponse } from "next/server";
import { studyContext } from "@/lib/study/deps";
import { endNow } from "@/lib/study/service";
import { jsonResult } from "@/lib/server/memberContext";

// POST /api/study/end: leave the seat; settles minutes and bonus once.
export async function POST() {
  const ctx = await studyContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await endNow(ctx.store, ctx.userId, ctx.now), "study");
}
