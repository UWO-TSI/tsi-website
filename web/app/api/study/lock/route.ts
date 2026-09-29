import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseStudyStore } from "@/lib/study/supabaseStore";
import { lock } from "@/lib/study/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({ table_id: z.string().uuid(), is_private: z.boolean(), allowed: z.array(z.string().uuid()).max(12).optional() });

// POST /api/study/lock: the seated host makes the table private (friends in `allowed`) or opens it.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseStudyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await lock(ctx.store, ctx.userId, parsed.data, ctx.now), "study");
}
