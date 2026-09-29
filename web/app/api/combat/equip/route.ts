import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { equipWeapon } from "@/lib/combat/service";

// POST /api/combat/equip { weapon }: one equipped weapon (visible on the character everywhere, row 140).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ weapon: z.string().regex(/^[a-z0-9-]{1,48}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await equipWeapon(ctx.store, ctx.userId, parsed.data.weapon), "equip");
}
