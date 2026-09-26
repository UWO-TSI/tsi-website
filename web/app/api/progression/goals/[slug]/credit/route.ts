import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseProgressionStore } from "@/lib/progression/supabaseStore";
import { badRequest, forbidden, isAdminTier, jsonResult, withStore } from "@/lib/server/memberContext";
import { adminCredit } from "@/lib/progression/service";

const Body = z.object({
  member_id: z.string().uuid(),
  points: z.number().int().min(1).max(5000),
  note: z.string().trim().max(200).optional(),
  idempotency_key: z.string().min(8).max(128),
});

// POST /api/progression/goals/:slug/credit (T1/T2): admin-logged real contribution.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ctx = await withStore(supabaseProgressionStore);
  if (ctx instanceof NextResponse) return ctx;
  if (!isAdminTier(ctx.tier)) return forbidden();
  const { slug } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[a-z0-9-]{1,64}$/.test(slug)) return badRequest();
  return jsonResult(
    await adminCredit(ctx.store, ctx.userId, { goal_slug: slug, member_id: parsed.data.member_id, points: parsed.data.points, note: parsed.data.note || null, idempotency_key: `admin:${parsed.data.idempotency_key}` }, ctx.now),
    "credit",
  );
}
