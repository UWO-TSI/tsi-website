import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonResult, memberContext } from "@/lib/server/memberContext";
import { craft } from "@/lib/crafting/service";
import { supabaseCraftingStore } from "@/lib/crafting/supabaseStore";

const Body = z.object({ recipe_id: z.string().regex(/^[a-z0-9-]{1,48}$/), idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) });

// POST /api/crafting/craft: ingredients debited and the item credited once per key; retry with the same key.
export async function POST(request: Request) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await craft(supabaseCraftingStore(ctx.db), ctx.userId, parsed.data), "craft");
}
