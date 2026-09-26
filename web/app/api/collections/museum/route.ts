import { NextResponse } from "next/server";
import { collectionsContext } from "@/lib/collections/deps";
import { museum } from "@/lib/collections/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/collections/museum: the three wings, filled cases with donor names, empty cases unnamed.
export async function GET() {
  const ctx = await collectionsContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await museum(ctx.store), "wings");
}
