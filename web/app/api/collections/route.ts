import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { catchAction } from "@/lib/collections/service";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { islandWeatherNow } from "@/lib/server/weather";

/**
 * Member collections: stackable collectibles (fish, bugs, fruit, flowers,
 * shells, minerals). The stock sells for play coins through /api/economy/sell.
 *
 * GET  → the caller's collection rows.
 * POST → a catch from the world, rolled and recorded by the server
 *        (lib/collections/service.ts catchAction): harvest, cast, land.
 *        A client-reported species or size is never accepted.
 */

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
  // Service role only: members can't write member_collections (20260926150900);
  // the catch-roll functions (20260929100000) keep the hourly caps.
  const body = await request.json().catch(() => null);
  return jsonResult(await catchAction(ctx.store, ctx.userId, body, ctx.now, await islandWeatherNow(ctx.now)), "catch");
}
