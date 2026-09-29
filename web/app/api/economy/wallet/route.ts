import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { getWallet } from "@/lib/wallet/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/economy/wallet: coins and Gems, whether today's gift is claimed, recent ledger.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await getWallet(ctx.store, ctx.userId, ctx.now), "wallet");
}
