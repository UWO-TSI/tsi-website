import { NextResponse } from "next/server";
import { economyContext } from "@/lib/wallet/deps";
import { getWallet } from "@/lib/wallet/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/economy/wallet: coins and Gems, whether today's gift is claimed, recent ledger.
export async function GET() {
  const ctx = await economyContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await getWallet(ctx.store, ctx.userId, ctx.now), "wallet");
}
