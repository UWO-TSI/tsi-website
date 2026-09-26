import { NextResponse } from "next/server";
import { z } from "zod";
import { progressionContext } from "@/lib/progression/deps";
import { badRequest, readJson } from "@/lib/progression/http";
import { storeFailure } from "@/lib/progression/service";

const Body = z.object({ hud_muted: z.boolean() });

// POST /api/progression/prefs: hide/show the objective line (design principle 7).
export async function POST(request: Request) {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) return badRequest();
  try {
    await ctx.store.setHudMuted(ctx.userId, parsed.data.hud_muted);
    return NextResponse.json({ ok: true, hud_muted: parsed.data.hud_muted });
  } catch (err) {
    const f = storeFailure(err);
    return NextResponse.json({ ok: false, error: f.error, code: f.code }, { status: f.status });
  }
}
