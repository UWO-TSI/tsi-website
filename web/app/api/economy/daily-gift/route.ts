import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { claimDailyGift } from "@/lib/wallet/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/economy/daily-gift: once per Toronto calendar day.
export async function POST() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await claimDailyGift(ctx.store, ctx.userId), "gift");
}
