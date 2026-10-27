import { NextResponse } from "next/server";
import { z } from "zod";
import { activeWaters } from "@/lib/collections/rolls";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { fillFishRequest, fishRequestsView } from "@/lib/wallet/service";

const Body = z.object({ item_key: z.string().regex(/^[a-z0-9_]{1,64}$/), board: z.enum(["market", "chef"]).optional(), idempotency_key: IdemKey });

// GET /api/economy/requests: the fish market's 3 requests today, the sushi chef's order, and which you filled.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await fishRequestsView(ctx.store, ctx.userId, new Date(), activeWaters()), "requests");
}

// POST /api/economy/requests: hand one requested fish over (board market or chef) for its reward; retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await fillFishRequest(ctx.store, ctx.userId, parsed.data, new Date(), activeWaters()), "fill");
}
