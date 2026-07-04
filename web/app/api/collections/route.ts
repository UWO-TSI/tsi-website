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

const ITEM_KEYS = [
  "apple",
  "peach",
  "acorn",
  "flower_red",
  "flower_purple",
  "flower_yellow",
  "fish_common",
  "fish_river",
  "fish_rare",
] as const;

const CollectSchema = z.object({
  item_key: z.enum(ITEM_KEYS),
});

export async function GET() {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
