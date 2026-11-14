import { NextResponse } from "next/server";
import { adminContext } from "@/lib/server/adminContext";
import { buildReport, rangeOf, type Snapshot } from "@/lib/analytics/report";

const unavailable = () => NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });

// GET /api/admin/game-analytics?days=30: T1/T2 only. The snapshot is read with the service role and added up here, so
// account ids never leave the server; the page gets world names and numbers.
export async function GET(req: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const range = rangeOf(Number(new URL(req.url).searchParams.get("days")), ctx.now);
  const { data, error } = await ctx.db.rpc("game_analytics_snapshot", { p_since: range.since });
  if (error || !data) return unavailable();
  return NextResponse.json({ ok: true, report: buildReport(data as Snapshot, { ...range, now: ctx.now }) });
}
