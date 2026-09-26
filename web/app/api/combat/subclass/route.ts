import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { chooseSubclass } from "@/lib/combat/service";

// POST /api/combat/subclass { subclass, idempotency_key }: level-10 choice within your family; later changes cost coins.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ subclass: z.string().regex(/^[a-z]{3,20}$/), idempotency_key: IdemKey }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await chooseSubclass(ctx.store, ctx.userId, parsed.data.subclass, parsed.data.idempotency_key), "subclass");
}
