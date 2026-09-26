import { NextResponse } from "next/server";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { trophies } from "@/lib/collections/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/collections/trophies: HQ trophy case, this week's best catches (Monday start, Toronto).
export async function GET() {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await trophies(ctx.store, ctx.now), "case");
}
