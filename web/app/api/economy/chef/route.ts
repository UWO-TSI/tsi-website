import { NextResponse } from "next/server";
import { z } from "zod";
import { activeWaters } from "@/lib/collections/rolls";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { chefView, fillChefOrder } from "@/lib/wallet/service";

const Body = z.object({ item_key: z.string().regex(/^[a-z0-9_]{1,64}$/), idempotency_key: IdemKey });

// GET /api/economy/chef: the sushi chef's order today, and whether you filled it.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await chefView(ctx.store, ctx.userId, new Date(), activeWaters()), "chef");
}

// POST /api/economy/chef: hand the chef today's fish for its coins and a staff meal; retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await fillChefOrder(ctx.store, ctx.userId, parsed.data, new Date(), activeWaters()), "fill");
}
