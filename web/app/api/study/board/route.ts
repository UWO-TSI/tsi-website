import { NextResponse } from "next/server";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { board } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/study/board: this week's top studiers, opt-in members only.
export async function GET() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await board(ctx.store, ctx.now), "board");
}
