import { NextResponse } from "next/server";
import { supabaseHomesStore } from "@/lib/homes-sync/supabaseStore";
import { loadHome } from "@/lib/homes-sync/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/homes: the caller's home (layout doc v1, rooms, revision, room price/cap).
export async function GET() {
  const ctx = await withStore(supabaseHomesStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await loadHome(ctx.store, ctx.userId), "home");
}
