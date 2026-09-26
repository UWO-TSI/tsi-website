import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { getShop } from "@/lib/wallet/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/economy/shop: catalogue by tab (tools, outfits, furniture, specials, merch) with today's specials.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await getShop(ctx.store, ctx.userId, ctx.now), "shop");
}
