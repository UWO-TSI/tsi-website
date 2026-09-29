import { NextResponse } from "next/server";
import { z } from "zod";
import { ADVANCE_ACTIONS } from "@/lib/progression/chapters";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { badRequest, jsonResult, withStore } from "@/lib/server/memberContext";
import { advanceChapter } from "@/lib/progression/service";

const Body = z.object({
  chapter_slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  action: z.enum(ADVANCE_ACTIONS),
});

// POST /api/progression/chapters/advance: request one step; the server checks it.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  return jsonResult(await advanceChapter(ctx.store, ctx.userId, parsed.data, ctx.now), "state");
}
