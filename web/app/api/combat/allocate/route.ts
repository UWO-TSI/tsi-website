import { NextResponse } from "next/server";
import { z } from "zod";
import { combatContext } from "@/lib/combat/deps";
import { jsonResult } from "@/lib/server/memberContext";
import { allocateStats } from "@/lib/combat/service";

// POST /api/combat/allocate { might?, finesse?, arcana?, spirit?, vitality? }: add points (removing needs a reset).
export async function POST(request: Request) {
  const ctx = await combatContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.record(z.string(), z.number().int().min(0).max(200)).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await allocateStats(ctx.store, ctx.userId, parsed.data), "stats");
}
