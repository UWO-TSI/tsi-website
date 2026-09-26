import { NextResponse } from "next/server";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { listMissions } from "@/lib/combat/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/combat/missions: the board, with your open progress and cooldowns.
export async function GET() {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await listMissions(ctx.store, ctx.userId, ctx.now), "missions");
}
