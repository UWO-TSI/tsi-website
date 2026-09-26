import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { withStore } from "@/lib/server/memberContext";
import { buy } from "@/lib/wallet/service";

/**
 * Wharf Shack gear shelf, now on the shop catalogue + member_inventory.
 * Legacy gear keys (rod_cedar, rod_glass, bobber_lucky) are the items'
 * `catalogue_ref`, so the island's gear code keeps working.
 *
 * GET  → { gear: string[] | null } (owned legacy keys; null = no server wallet)
 * POST { item, idempotency_key? } → buys the item at the server price.
 * Gear is cosmetic flair only (design principle #4).
 */

const BuySchema = z.object({
  item: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/).optional(),
});

export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return NextResponse.json({ gear: null });
  try {
    const inv = await ctx.store.inventory(ctx.userId);
    return NextResponse.json({ gear: inv.filter((r) => r.item.category === "tool").map((r) => r.item.catalogue_ref ?? r.item.slug) });
  } catch {
    return NextResponse.json({ gear: null });
  }
}

export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return NextResponse.json({ error: "Unauthorized" }, { status: ctx.status === 401 ? 401 : 503 });
  const parsed = BuySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  const items = await ctx.store.catalogue().catch(() => null);
  const item = items?.find((i) => i.catalogue_ref === parsed.data.item || i.slug === parsed.data.item);
  if (!item) return NextResponse.json({ error: "Unknown item" }, { status: 404 });
  const r = await buy(ctx.store, ctx.userId, { item_id: item.id, qty: 1, idempotency_key: parsed.data.idempotency_key ?? `gear-${crypto.randomUUID()}` }, ctx.now);
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  const inv = await ctx.store.inventory(ctx.userId);
  return NextResponse.json({ coins: r.data.balance, gear: inv.filter((x) => x.item.category === "tool").map((x) => x.item.catalogue_ref ?? x.item.slug) });
}
