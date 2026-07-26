import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Wharf Shack gear shelf (Economy v2 E4).
 *
 * GET  → { gear: string[] | null } — null when no server profile reachable
 *        (env-less / unauthed / pre-migration); clients use the local mirror.
 * POST { item } → buy_gear() RPC: debits coins + appends the item
 *        atomically, price from the server-side gear_prices table.
 *
 * Gear is cosmetic flair only (design principle #4) — never a mechanic gate.
 */

const BuySchema = z.object({
  item: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
});

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ gear: null });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ gear: null });
  }
  const { data, error } = await supabase.from("profiles").select("gear").eq("id", user.id).maybeSingle();
  if (error) {
    return NextResponse.json({ gear: null });
  }
  return NextResponse.json({ gear: (data as { gear?: string[] } | null)?.gear ?? [] });
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
  const parsed = BuySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid gear payload" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("buy_gear", {
    p_item: parsed.data.item,
  } as never);
  if (error) {
    return NextResponse.json({ error: "Shop unavailable" }, { status: 503 });
  }
  const row = (Array.isArray(data) ? data[0] : data) as { coins: number; gear: string[] } | undefined;
  return NextResponse.json({ coins: row?.coins ?? null, gear: row?.gear ?? null });
}
