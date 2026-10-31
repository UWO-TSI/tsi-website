import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { rollAtTackle, tackleView } from "@/lib/wallet/service";

const Body = z.object({ counter: z.enum(["coins", "gems"]), pulls: z.union([z.literal(1), z.literal(10)]), idempotency_key: IdemKey });

// GET /api/economy/tackle: the tackle shop's two counters this season, their prices and every prize's odds.
export async function GET() {
  return NextResponse.json({ ok: true, tackle: tackleView(new Date()) });
}

// POST /api/economy/tackle: roll 1 or 10 at the coin or Gem counter (the server rolls); retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await rollAtTackle(ctx.store, ctx.userId, parsed.data, new Date()), "roll");
}
