import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { myStats } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/study/stats: your minutes this week, longest block, sessions, board opt-in.
export async function GET() {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await myStats(ctx.store, ctx.userId, ctx.now), "stats");
}

// POST /api/study/stats { board_opt_in }: join or leave the cafe board (row 171).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ board_opt_in: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  try {
    await ctx.store.setBoardOptIn(ctx.userId, parsed.data.board_opt_in);
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't save that." }, { status: 503 });
  }
  return jsonResult(await myStats(ctx.store, ctx.userId, ctx.now), "stats");
}
