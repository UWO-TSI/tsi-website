import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { withStore } from "@/lib/server/memberContext";

/**
 * Play-coin balance (single wallet, 20260926150600_economy.sql).
 *
 * GET  → { coins: number | null } (null = no server wallet reachable; the
 *        client keeps its local mirror).
 * POST → 410. Clients can no longer credit themselves: coins come only from
 *        server-side sources (study, selling, chapter rewards, the daily
 *        gift, in-person events), each through wallet_apply().
 */
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return NextResponse.json({ coins: null });
  try {
    return NextResponse.json({ coins: (await ctx.store.wallet(ctx.userId)).coins });
  } catch {
    return NextResponse.json({ coins: null });
  }
}

export async function POST() {
  return NextResponse.json({ error: "Coins are earned by studying, selling, quests and club events." }, { status: 410 });
}
