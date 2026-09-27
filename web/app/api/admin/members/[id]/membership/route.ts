// T1/T2 mark an account as a TSI member or a public account (ruling 1).
// admin_set_membership (20260926200000) moves the tier with it: public is T5,
// a public account marked member gets T4; staff can't be made public.
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, forbidden, isAdminTier, memberContext } from "@/lib/server/memberContext";

const Body = z.object({ membership: z.enum(["member", "public"]) });
const REFUSED: Record<string, [number, string]> = {
  forbidden: [403, "Forbidden: T1/T2 only"],
  not_found: [404, "Member not found."],
  staff: [409, "Staff (T1-T3) stay members. Change their tier first."],
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!isAdminTier(ctx.tier)) return forbidden();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return badRequest();
  const { data, error } = await ctx.db.rpc("admin_set_membership", { p_actor_id: ctx.userId, p_member_id: id, p_membership: parsed.data.membership });
  if (error) {
    const [status, message] = REFUSED[error.message] ?? [500, "Something went wrong. Try again."];
    return NextResponse.json({ ok: false, error: message }, { status });
  }
  const row = (Array.isArray(data) ? data[0] : data) as { membership: string; tier: number };
  return NextResponse.json({ ok: true, member: { id, membership: row.membership, tier: row.tier } });
}
