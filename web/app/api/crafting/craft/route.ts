import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { craft } from "@/lib/crafting/service";
import { supabaseCraftingStore } from "@/lib/crafting/supabaseStore";

const Body = z.object({ recipe_id: z.string().regex(/^[a-z0-9-]{1,48}$/), idempotency_key: IdemKey });

// POST /api/crafting/craft: ingredients debited and the item credited once per key; retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCraftingStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  return jsonResult(await craft(ctx.store, ctx.userId, parsed.data), "craft");
}
