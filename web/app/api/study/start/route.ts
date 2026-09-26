import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { startSession } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({ focus_len: z.number().int(), break_len: z.number().int(), cycles: z.number().int() });

// POST /api/study/start: pick focus/break/cycles for this sit-down (presets 25/5×4, 50/10×2).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await startSession(ctx.store, ctx.userId, parsed.data, ctx.now), "study");
}
