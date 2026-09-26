import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { getInventory } from "@/lib/wallet/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/economy/inventory: owned items grouped by shop tab, with equipped state.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await getInventory(ctx.store, ctx.userId), "inventory");
}
