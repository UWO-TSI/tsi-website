import { NextResponse } from "next/server";
import { combatContext } from "@/lib/combat/deps";
import { islandProgression } from "@/lib/combat/islandAdapter";
import { getProgression } from "@/lib/combat/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/combat/progression: XP/level, stats and points, derived numbers, family/subclass (choices at 10), weapons with durability, and the ruins gate.
export async function GET() {
  const ctx = await combatContext();
  if (ctx instanceof NextResponse) return ctx;
  const r = await getProgression(ctx.store, ctx.userId);
  if (!r.ok) return jsonResult(r, "progression");
  return NextResponse.json({ ok: true, progression: r.data, gate: islandProgression(r.data) });
}
