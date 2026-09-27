import { NextResponse } from "next/server";
import { studyContext } from "@/lib/study/deps";
import { getState } from "@/lib/study/service";

// GET /api/study/tables: tables with occupancy and privacy (private tables read as occupied).
export async function GET() {
  const ctx = await studyContext();
  if (ctx instanceof NextResponse) return ctx;
  const r = await getState(ctx.store, ctx.userId, ctx.now);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ ok: true, tables: r.data.tables });
}
