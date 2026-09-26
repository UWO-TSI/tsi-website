import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { buy } from "@/lib/wallet/service";

const Body = z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1).max(20).default(1), idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) });

// POST /api/economy/buy: the server prices it (specials included); retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await buy(ctx.store, ctx.userId, parsed.data, ctx.now), "purchase");
}
