import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { tradeForTraining } from "@/lib/wallet/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/economy/rod-trade: the rod seller's quest, your Flimsy rod for the Training rod (lib/game/rods.ts TRAINING).
export async function POST() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await tradeForTraining(ctx.store, ctx.userId), "trade");
}
