import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { claimMinibossReward } from "@/lib/combat/service";

// POST /api/combat/miniboss-reward { enemy, event_key }: a mini-boss's drop (the elder thorn crab), rolled here, once per recorded kill (20 h cooldown).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ enemy: z.string().regex(/^[a-z0-9-]{1,48}$/), event_key: IdemKey }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await claimMinibossReward(ctx.store, ctx.userId, parsed.data.enemy, parsed.data.event_key), "boss");
}
