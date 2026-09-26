import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseHomesStore } from "@/lib/homes-sync/supabaseStore";
import { buyRoom } from "@/lib/homes-sync/service";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({
  expected_price: z.number().int().min(0),
  idempotency_key: IdemKey,
});

// POST /api/homes/rooms: buy the next room (server price, cap 4, coins from profiles.coins).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseHomesStore);
  if (ctx instanceof NextResponse) return ctx;
  const body = await request.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await buyRoom(ctx.store, ctx.userId, parsed.data), "purchase");
}
