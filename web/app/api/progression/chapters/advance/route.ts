import { NextResponse } from "next/server";
import { z } from "zod";
import { ADVANCE_ACTIONS } from "@/lib/progression/chapters";
import { progressionContext } from "@/lib/progression/deps";
import { badRequest, readJson, respond } from "@/lib/progression/http";
import { advanceChapter } from "@/lib/progression/service";

const Body = z.object({
  chapter_slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  action: z.enum(ADVANCE_ACTIONS),
});

// POST /api/progression/chapters/advance: request one step; the server checks it.
export async function POST(request: Request) {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) return badRequest();
  return respond(await advanceChapter(ctx.store, ctx.userId, parsed.data, ctx.now), "state");
}
