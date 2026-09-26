import { NextResponse } from "next/server";
import { collectionsContext, momentFrom } from "@/lib/collections/deps";
import { journal } from "@/lib/collections/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/collections/journal?category=fish[&hour=21&weather=rain]
// One journal page: known species with catch-card data and personal records;
// unknown ones as silhouettes with clues only (no names). Availability uses
// the island clock (Toronto) unless the client passes its hour/weather.
export async function GET(request: Request) {
  const ctx = await collectionsContext();
  if (ctx instanceof NextResponse) return ctx;
  const url = new URL(request.url);
  return jsonResult(await journal(ctx.store, ctx.userId, url.searchParams.get("category") ?? "fish", momentFrom(url, ctx.now)), "page");
}
