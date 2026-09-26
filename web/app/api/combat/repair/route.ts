import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { repairWeapon } from "@/lib/combat/service";

// POST /api/combat/repair { weapon, idempotency_key }: repair to full for coins (cost by tier and missing durability).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ weapon: z.string().regex(/^[a-z0-9-]{1,48}$/), idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await repairWeapon(ctx.store, ctx.userId, parsed.data.weapon, parsed.data.idempotency_key), "repair");
}
