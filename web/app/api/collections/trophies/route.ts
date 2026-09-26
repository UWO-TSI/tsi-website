import { NextResponse } from "next/server";
import { collectionsContext } from "@/lib/collections/deps";
import { trophies } from "@/lib/collections/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/collections/trophies: HQ trophy case, this week's best catches (Monday start, Toronto).
export async function GET() {
  const ctx = await collectionsContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await trophies(ctx.store, ctx.now), "case");
}
