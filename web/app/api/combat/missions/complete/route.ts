import { NextResponse } from "next/server";
import { z } from "zod";
import { combatContext } from "@/lib/combat/deps";
import { jsonResult } from "@/lib/server/memberContext";
import { completeMission } from "@/lib/combat/service";

// POST /api/combat/missions/complete { progress_id }: turn in a ready mission; rewards once (retry-safe).
export async function POST(request: Request) {
  const ctx = await combatContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ progress_id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await completeMission(ctx.store, ctx.userId, parsed.data.progress_id), "rewards");
}
