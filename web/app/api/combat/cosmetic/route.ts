import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { equipCosmetic } from "@/lib/combat/service";

// POST /api/combat/cosmetic { subclass, kind, value }: classes v2 (§1.10). Equip an owned weapon skin, aura colours or nameplate frame,
// or a mastery one the subclass has reached ("mastery:bronze" …), on one subclass; value null takes it off. Idempotent (a set).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({
    subclass: z.string().regex(/^[a-z][a-z0-9-]{1,31}$/),
    kind: z.enum(["weapon_skin", "aura", "frame"]),
    value: z.string().regex(/^(mastery:[a-z]{1,12}|[0-9a-f-]{36})$/).nullable(),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await equipCosmetic(ctx.store, ctx.userId, parsed.data.subclass, parsed.data.kind, parsed.data.value), "cosmetics");
}
