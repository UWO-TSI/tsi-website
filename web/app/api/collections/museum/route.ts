import { NextResponse } from "next/server";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { museum } from "@/lib/collections/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/collections/museum: the three wings, filled cases with donor names, empty cases unnamed.
export async function GET() {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await museum(ctx.store), "wings");
}
