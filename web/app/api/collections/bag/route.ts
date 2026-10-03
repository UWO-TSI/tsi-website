import { NextResponse } from "next/server";
import { bagAction, bagView } from "@/lib/collections/service";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";

/**
 * The backpack and the home storage chest (specs/game-ui.md milestone 2), through the service role.
 * GET  → the bag's stacks (with their locks), its size and the chest.
 * POST → { action: lock | drop | store | take | store_materials, ... } (lib/collections/service.ts bagAction), answered with the bag as it is now.
 */
export async function GET() {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await bagView(ctx.store, ctx.userId), "bag");
}

export async function POST(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await bagAction(ctx.store, ctx.userId, await request.json().catch(() => null)), "bag");
}
