import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { tameBeast } from "@/lib/combat/service";

// POST /api/combat/tame { beast, event_key }: classes v2, the Summoner (design sheet "Summoner (LOCKED)"). The ritual
// circle's untamed form fell: record the taming of the next beast in turn (owl, toad, serpent, rabbits). Idempotent by key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({
    beast: z.enum(["owl", "toad", "serpent", "rabbits"]),
    event_key: z.string().regex(/^tame:[a-z]{2,10}:[a-z0-9:]{1,48}$/),
  }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await tameBeast(ctx.store, ctx.userId, parsed.data.beast, parsed.data.event_key), "tamed");
}
