import { NextResponse } from "next/server";
import { studyContext } from "@/lib/study/deps";
import { board } from "@/lib/study/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/study/board: this week's top studiers, opt-in members only.
export async function GET() {
  const ctx = await studyContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await board(ctx.store, ctx.now), "board");
}
