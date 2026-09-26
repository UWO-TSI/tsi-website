import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { reserveMerch } from "@/lib/wallet/service";

const Body = z.object({ item_id: z.string().uuid(), idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) });

// POST /api/economy/merch/reserve: holds stock and Gems for campus pickup; retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await reserveMerch(ctx.store, ctx.userId, parsed.data), "reservation");
}
