import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordCatch } from "@/lib/collections/service";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { withStore } from "@/lib/server/memberContext";

/**
 * Member collections: stackable collectibles (fruit, flowers, fish). The
 * stock sells for play coins through /api/economy/sell.
 *
 * GET  → the caller's collection rows.
 * POST → collect one item through collections_record_catch (count+1, capped).
 */

// Shape validation only, so new species need zero API edits. Sold stock is
// bounded by the per-species hourly cap in collections_record_catch, and only
// roster / fish_prices species have a sell price.
const CollectSchema = z.object({
  item_key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  // 031: catch size for the catch card / personal record (clamped server-side).
  size_cm: z.number().positive().max(10000).optional(),
});

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    // Env-less dev/preview: behave like an empty book, not a 500.
    return NextResponse.json({ collections: [] });
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("member_collections")
    .select("item_key, count, first_collected_at")
    .eq("user_id", user.id)
    .order("item_key");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ collections: data ?? [] });
}

export async function POST(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CollectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid item_key" }, { status: 400 });
  }
  const { item_key, size_cm } = parsed.data;

  // Service role only: members can't write member_collections (20260926150900),
  // and collections_record_catch caps catches per species per hour.
  const r = await recordCatch(ctx.store, ctx.userId, item_key, size_cm);
  if (r.ok) return NextResponse.json(r.data);
  return NextResponse.json({ error: r.error }, { status: r.status });
}
