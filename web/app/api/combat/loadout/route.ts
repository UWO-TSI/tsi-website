import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCombatStore } from "@/lib/combat/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { setLoadout } from "@/lib/combat/service";

// POST /api/combat/loadout { loadout: string[] }: up to four abilities from your subclass kit (row 50), chosen at the Oracle.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCombatStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ loadout: z.array(z.string().regex(/^[a-z0-9.-]{1,40}$/)).min(1).max(4) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await setLoadout(ctx.store, ctx.userId, parsed.data.loadout), "loadout");
}
