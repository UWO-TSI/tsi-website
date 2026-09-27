import { NextResponse } from "next/server";
import { z } from "zod";
import { economyContext } from "@/lib/wallet/deps";
import { sell } from "@/lib/wallet/service";

/**
 * Catch sale (legacy path used by the Wharf Shack sheet), now on the single
 * wallet: prices by category and rarity from 033's sell_prices, stock from
 * member_collections, coins through wallet_apply. Pass `idempotency_key` to
 * make retries safe; without one each call is a new sale (legacy clients).
 * New code should call POST /api/economy/sell.
 */

const SellSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  qty: z.number().int().min(1).max(200),
  idempotency_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/).optional(),
});

export async function POST(request: Request) {
  const ctx = await economyContext();
  if (ctx instanceof NextResponse) return NextResponse.json({ error: "Unauthorized" }, { status: ctx.status === 401 ? 401 : 503 });
  const parsed = SellSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid sale payload" }, { status: 400 });
  const key = parsed.data.idempotency_key ?? `legacy-${crypto.randomUUID()}`;
  const r = await sell(ctx.store, ctx.userId, { item_key: parsed.data.key, qty: parsed.data.qty, idempotency_key: key });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ coins: r.data.balance, remaining: r.data.remaining, paid: r.data.paid });
}
