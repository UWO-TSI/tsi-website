import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { startReading } from "@/lib/oracle/service";

const Body = z.object({ start_key: IdemKey });

// POST /api/oracle/start: begin or resume a reading. After a result, a new reading is a paid respec (cooldown applies). Retry-safe per start_key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await startReading(ctx.store, ctx.userId, parsed.data.start_key, ctx.now), "reading");
}
