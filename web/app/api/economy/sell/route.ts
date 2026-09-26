import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { sell, sellList } from "@/lib/wallet/service";

const Body = z.object({ item_key: z.string().regex(/^[a-z0-9_]{1,64}$/), qty: z.number().int().min(1).max(200), idempotency_key: IdemKey });

// GET /api/economy/sell: what you can sell and the price each (by category and rarity).
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await sellList(ctx.store, ctx.userId), "sellable");
}

// POST /api/economy/sell: sell from your collection; retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await sell(ctx.store, ctx.userId, parsed.data), "sale");
}
