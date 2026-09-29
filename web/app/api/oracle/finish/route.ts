import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { finishReading } from "@/lib/oracle/service";

const Body = z.object({ attempt_id: z.string().uuid(), tie_answers: z.record(z.string(), z.string().length(1)).optional() });

// POST /api/oracle/finish: score the reading. Returns tie-breaker questions if a dichotomy is exactly even; otherwise type, family, colour and aura.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await finishReading(ctx.store, ctx.userId, parsed.data.attempt_id, parsed.data.tie_answers), "result");
}
