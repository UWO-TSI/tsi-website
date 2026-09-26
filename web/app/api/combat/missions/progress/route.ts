import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { missionProgress } from "@/lib/combat/service";
import type { MissionEvent } from "@/lib/combat/missions";

const Event = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1).max(80), type: z.literal("kill"), enemy: z.string().max(48) }),
  z.object({ id: z.string().min(1).max(80), type: z.literal("pickup"), item: z.string().max(48) }),
  z.object({ id: z.string().min(1).max(80), type: z.literal("wave_cleared"), wave: z.number().int().min(1).max(50) }),
  z.object({ id: z.string().min(1).max(80), type: z.literal("checkpoint"), n: z.number().int().min(1).max(50) }),
  z.object({ id: z.string().min(1).max(80), type: z.enum(["return", "arrived", "escort_down", "defeat", "abandon"]) }),
]);

// POST /api/combat/missions/progress { progress_id, events[] }: events are applied once each (by id).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ progress_id: z.string().uuid(), events: z.array(Event).min(1).max(100) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await missionProgress(ctx.store, ctx.userId, parsed.data.progress_id, parsed.data.events as MissionEvent[]), "mission");
}
