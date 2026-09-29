import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { claimBossReward } from "@/lib/combat/service";

// POST /api/combat/boss-reward { event_key }: the guardian statue's drop, rolled here, once per recorded boss kill (20 h cooldown).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ event_key: IdemKey }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await claimBossReward(ctx.store, ctx.userId, parsed.data.event_key), "boss");
}
