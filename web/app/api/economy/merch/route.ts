import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { merchView } from "@/lib/wallet/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/economy/merch: the Gems merch corner and your pickups.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await merchView(ctx.store, ctx.userId, ctx.now), "merch");
}
