import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Atomic catch sale (Economy v2 E4 — specs/economy-v2-currencies.md).
 *
 * POST { key, qty } → sell_catches() RPC: decrements member_collections
 * and credits coins in one transaction, with the price resolved from the
 * server-side fish_prices table (clients never name a price). The client
 * stays local-first: WharfSellSheet updates its mirrors immediately and
 * calls this fire-and-forget; pre-migration DBs 503 and the local path
 * remains the balance of record.
 */

const SellSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  qty: z.number().int().min(1).max(200),
});

export async function POST(request: Request) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SellSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sale payload" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("sell_catches", {
    p_key: parsed.data.key,
    p_qty: parsed.data.qty,
  } as never);
  if (error) {
    return NextResponse.json({ error: "Sale unavailable" }, { status: 503 });
  }
  const row = (Array.isArray(data) ? data[0] : data) as { coins: number; remaining: number } | undefined;
  return NextResponse.json({ coins: row?.coins ?? null, remaining: row?.remaining ?? null });
}
