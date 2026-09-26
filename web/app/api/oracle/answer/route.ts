import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { answerBatch } from "@/lib/oracle/service";

const Body = z.object({
  attempt_id: z.string().uuid(),
  answers: z.array(z.object({ item_id: z.string().max(8), value: z.number().int().min(-2).max(2) })).min(1).max(64),
});

// POST /api/oracle/answer: save a batch of answers (-2..2). Returns progress and the keeper's beat every ~10 answers.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await answerBatch(ctx.store, ctx.userId, parsed.data.attempt_id, parsed.data.answers), "progress");
}
