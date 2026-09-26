import { NextResponse } from "next/server";
import { combatContext } from "@/lib/combat/deps";
import { listMissions } from "@/lib/combat/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/combat/missions: the board, with your open progress and cooldowns.
export async function GET() {
  const ctx = await combatContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await listMissions(ctx.store, ctx.userId, ctx.now), "missions");
}
