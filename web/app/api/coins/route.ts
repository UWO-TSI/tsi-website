import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Game coins wallet API (Economy v2 — specs/economy-v2-currencies.md).
 *
 * GET  → the caller's coin balance ({ coins: number | null } — null means
 *        no server wallet reachable; clients fall back to the local mirror).
 * POST → earn coins via the SECURITY DEFINER earn_coins() RPC (capped
 *        server-side; clients cannot write the column directly).
 *
 * Coins are the PLAY currency (TC 🪙) — never the money tier (Gems), never
 * convertible. Requires migration 024_game_coins.sql on the target DB.
 */

const EarnSchema = z.object({
  amount: z.number().int().min(1).max(4000),
  reason: z.string().min(1).max(64).regex(/^[a-z0-9_:-]+$/),
});

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ coins: null });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ coins: null });
  }
  const { data, error } = await supabase.from("profiles").select("coins").eq("id", user.id).maybeSingle();
  if (error) {
    // Pre-migration DBs have no coins column — behave like no wallet.
    return NextResponse.json({ coins: null });
  }
  return NextResponse.json({ coins: (data as { coins?: number } | null)?.coins ?? 0 });
}

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
  const parsed = EarnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid earn payload" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("earn_coins", {
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  } as never);
  if (error) {
    // Pre-migration DBs (no RPC yet): report gracefully; the client keeps
    // its local mirror as the balance of record until 024 lands.
    return NextResponse.json({ error: "Wallet unavailable" }, { status: 503 });
  }
  return NextResponse.json({ coins: data as number });
}
