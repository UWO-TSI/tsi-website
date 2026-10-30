import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, memberContext } from "@/lib/server/memberContext";

const Body = z.object({ ticket: z.string().uuid(), points: z.tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)]) });

/**
 * POST /api/volleyball/finish: a casual match ended (home is the caller's team). The database decides everything (a
 * legal finished set, a plausible time since the ticket opened, the daily cap) and pays a win once per ticket through
 * the wallet; a resend returns the first answer. `status`: won, lost, capped, too_fast, bad_score or expired.
 */
export async function POST(request: Request) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { ticket, points } = parsed.data;
  const { data, error } = await ctx.db.rpc("volleyball_casual_finish", { p_member_id: ctx.userId, p_ticket: ticket, p_home: points[0], p_away: points[1] });
  if (error) {
    if (error.message?.includes("not_found")) return NextResponse.json({ ok: false, error: "That match isn't yours.", code: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: false, error: "Something went wrong. Try again.", code: "failed" }, { status: 500 });
  }
  const r = (Array.isArray(data) ? data[0] : data) as { status: string; paid: number; balance: number; replayed: boolean };
  return NextResponse.json({ ok: true, result: { status: r.status, paid: Number(r.paid), balance: Number(r.balance), replayed: r.replayed === true } });
}
