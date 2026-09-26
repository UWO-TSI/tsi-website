import { NextResponse } from "next/server";
import { z } from "zod";
import { combatContext } from "@/lib/combat/deps";
import { jsonResult } from "@/lib/server/memberContext";
import { startMission } from "@/lib/combat/service";

// POST /api/combat/missions/start { mission, start_key }: one open run per mission; repeatable after its cooldown.
export async function POST(request: Request) {
  const ctx = await combatContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ mission: z.string().regex(/^[a-z0-9-]{1,48}$/), start_key: z.string().regex(/^[A-Za-z0-9_:-]{8,100}$/) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await startMission(ctx.store, ctx.userId, parsed.data.mission, parsed.data.start_key, ctx.now), "mission");
}
