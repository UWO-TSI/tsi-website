import { NextResponse } from "next/server";
import { z } from "zod";
import { combatContext } from "@/lib/combat/deps";
import { jsonResult } from "@/lib/server/memberContext";
import { chooseSubclass } from "@/lib/combat/service";

// POST /api/combat/subclass { subclass, idempotency_key }: level-10 choice within your family; later changes cost coins.
export async function POST(request: Request) {
  const ctx = await combatContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ subclass: z.string().regex(/^[a-z]{3,20}$/), idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await chooseSubclass(ctx.store, ctx.userId, parsed.data.subclass, parsed.data.idempotency_key), "subclass");
}
