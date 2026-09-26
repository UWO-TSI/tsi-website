// T1/T2 change another account's tier, active or alumni flag. Since
// 20260926120000 these columns are server-only, so the members page writes
// through here with the service role. Nobody changes their own tier, and only
// T1 grants T1 or edits a T1 account.
import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, forbidden, isAdminTier, memberContext } from "@/lib/server/memberContext";

const Body = z
  .object({ tier: z.number().int().min(1).max(5), is_active: z.boolean(), is_alumni: z.boolean() })
  .partial()
  .strict()
  .refine((b) => Object.keys(b).length > 0);
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!isAdminTier(ctx.tier)) return forbidden();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return badRequest();
  const patch = parsed.data;
  if (patch.tier !== undefined && id === ctx.userId) return fail(409, "You can't change your own tier.");
  const { data: target, error } = await ctx.db.from("profiles").select("tier").eq("id", id).maybeSingle();
  if (error) return fail(500, "Something went wrong. Try again.");
  if (!target) return fail(404, "Member not found.");
  if (ctx.tier !== 1 && (patch.tier === 1 || target.tier === 1)) return fail(403, "Only T1 can grant or change T1.");
  const { error: writeError } = await ctx.db.from("profiles").update(patch).eq("id", id);
  if (writeError) return fail(500, "Something went wrong. Try again.");
  return NextResponse.json({ ok: true, member: { id, ...patch } });
}
