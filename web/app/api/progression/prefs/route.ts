import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { badRequest, jsonResult, withStore } from "@/lib/server/memberContext";
import { storeFailure } from "@/lib/progression/service";

const Body = z.object({ hud_muted: z.boolean() });

// POST /api/progression/prefs: hide/show the objective line (design principle 7).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  try {
    await ctx.store.setHudMuted(ctx.userId, parsed.data.hud_muted);
    return NextResponse.json({ ok: true, hud_muted: parsed.data.hud_muted });
  } catch (err) {
    return jsonResult(storeFailure(err), "");
  }
}
