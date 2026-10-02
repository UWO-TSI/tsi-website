import { NextResponse } from "next/server";
import { eat } from "@/lib/collections/service";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// POST /api/collections/eat { item }: eat one held fruit (specs/game-ui.md §2); the server takes it from the stock.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await eat(ctx.store, ctx.userId, await request.json().catch(() => null)), "eaten");
}
