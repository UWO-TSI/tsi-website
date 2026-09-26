import { NextResponse } from "next/server";
import { z } from "zod";
import { studyContext } from "@/lib/study/deps";
import { sit } from "@/lib/study/service";
import { jsonResult } from "@/lib/server/memberContext";

const Body = z.object({ table_id: z.string().uuid(), seat: z.number().int().min(1).max(8) });

// POST /api/study/sit: claim a seat (first sitter hosts; private tables refuse outsiders). Retry-safe.
export async function POST(request: Request) {
  const ctx = await studyContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await sit(ctx.store, ctx.userId, parsed.data, ctx.now), "study");
}
