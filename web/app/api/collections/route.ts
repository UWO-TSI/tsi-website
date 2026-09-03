import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * Member collections (cozy marathon G1/G4/G5) — stackable cosmetic
 * collectibles: fruit, flowers, fish. No TC, no XP (principle #3).
 *
 * GET  → the caller's collection rows.
 * POST → collect one item: upsert (user_id, item_key) with count+1.
 */

// QA Wave 29 fix (2026-07-25): the original key ENUM went stale the moment
// species-true keys shipped (fish_dace, sea_scallop, bug_*, shore_*…) — the
// server was 400-ing every real catch while localStorage masked it. Shape
// validation only: collections carry no TC/XP (principle #3), so a
// whitelist buys nothing and rots every content drop. New species now need
// zero API edits (the book already derives from the FISH table).
const CollectSchema = z.object({
  item_key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
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
  const parsed = CollectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid item_key" }, { status: 400 });
  }
  const { item_key } = parsed.data;

  // Read-modify-write under the UNIQUE(user_id, item_key) constraint. Two
  // racing collects can lose one increment in the worst case — acceptable
  // for cosmetic collectibles; no economy rides on this counter.
  const { data: existing } = await supabase
    .from("member_collections")
    .select("id, count")
    .eq("user_id", user.id)
    .eq("item_key", item_key)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("member_collections")
      .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ item_key, count: existing.count + 1 });
  }

  const { error } = await supabase
    .from("member_collections")
    .insert({ user_id: user.id, item_key, count: 1 });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ item_key, count: 1 });
}
