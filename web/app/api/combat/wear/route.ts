import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { reportWear } from "@/lib/combat/service";

// POST /api/combat/wear { weapon, hits, defeated, idempotency_key }: encounter wear (defeat: durability only, no coins).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ weapon: z.string().regex(/^[a-z0-9-]{1,48}$/), hits: z.number().int().min(0).max(500), defeated: z.boolean(), idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const d = parsed.data;
  return jsonResult(await reportWear(ctx.store, ctx.userId, d.weapon, d.hits, d.defeated, d.idempotency_key), "weapon");
}
