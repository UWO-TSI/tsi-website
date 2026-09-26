import { NextResponse } from "next/server";
import { economyContext } from "@/lib/wallet/deps";
import { claimDailyGift } from "@/lib/wallet/service";
import { jsonResult } from "@/lib/server/memberContext";

// POST /api/economy/daily-gift: once per Toronto calendar day.
export async function POST() {
  const ctx = await economyContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await claimDailyGift(ctx.store, ctx.userId), "gift");
}
