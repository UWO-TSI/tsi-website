import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { allocateStats } from "@/lib/combat/service";

// POST /api/combat/allocate { might?, finesse?, arcana?, spirit?, vitality? }: the new totals (a retry changes nothing); lowering one needs a reset.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.record(z.string(), z.number().int().min(0).max(200)).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await allocateStats(ctx.store, ctx.userId, parsed.data), "stats");
}
