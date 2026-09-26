import { NextResponse } from "next/server";
import { economyContext } from "@/lib/wallet/deps";
import { getInventory } from "@/lib/wallet/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/economy/inventory: owned items grouped by shop tab, with equipped state.
export async function GET() {
  const ctx = await economyContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await getInventory(ctx.store, ctx.userId), "inventory");
}
