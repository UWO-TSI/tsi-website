import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { recordKill } from "@/lib/combat/service";

// POST /api/combat/kill { enemy, event_key }: XP once per kill event (hourly kill-XP cap).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ enemy: z.string().regex(/^[a-z0-9-]{1,48}$/), event_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await recordKill(ctx.store, ctx.userId, parsed.data.enemy, parsed.data.event_key), "xp");
}
