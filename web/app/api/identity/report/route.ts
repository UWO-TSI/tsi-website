import { NextResponse } from "next/server";
import { z } from "zod";
import { identityContext } from "@/lib/identity/deps";
import { jsonResult } from "@/lib/server/memberContext";
import { reportName } from "@/lib/identity/service";

// POST /api/identity/report { member_id, reason? }: report a name (row 221); lands for T1/T2.
export async function POST(request: Request) {
  const ctx = await identityContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ member_id: z.string().uuid(), reason: z.string().max(200).optional() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await reportName(ctx.store, ctx.userId, parsed.data.member_id, parsed.data.reason ?? ""), "report");
}
