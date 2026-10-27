import { NextResponse } from "next/server";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { records } from "@/lib/collections/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/collections/records: your size record per species and the club's catch board this week (Monday start, Toronto).
export async function GET() {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await records(ctx.store, ctx.userId, ctx.now), "records");
}
