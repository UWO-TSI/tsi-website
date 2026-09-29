import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { resetStats } from "@/lib/combat/service";

// POST /api/combat/reset-stats { idempotency_key }: coin-fee stat reset at the Oracle (XP, level and gear kept).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ idempotency_key: IdemKey }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await resetStats(ctx.store, ctx.userId, parsed.data.idempotency_key), "reset");
}
