import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";

// POST /api/volleyball/start: a casual match begins; the server opens its ticket (the claim at the end needs it).
export async function POST() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.db.rpc("volleyball_casual_start", { p_member_id: ctx.userId });
  const row = (Array.isArray(data) ? data[0] : data) as { ticket?: string; seed?: number } | null;
  if (error || !row?.ticket) return NextResponse.json({ ok: false, error: "Something went wrong. Try again.", code: "failed" }, { status: 500 });
  return NextResponse.json({ ok: true, ticket: { id: row.ticket, seed: Number(row.seed) } });
}
