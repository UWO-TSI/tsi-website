import { NextResponse } from "next/server";
import { z } from "zod";
import { economyContext } from "@/lib/wallet/deps";
import { jsonResult } from "@/lib/server/memberContext";
import { resolveMerch } from "@/lib/wallet/service";

const Body = z.object({ action: z.enum(["fulfil", "cancel"]), note: z.string().max(200).optional() });

// POST /api/economy/admin/merch/:id (T1/T2): fulfil (picked up) or cancel (Gems refunded, stock returned). Retry-safe.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await economyContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.tier !== 1 && ctx.tier !== 2) return NextResponse.json({ ok: false, error: "Forbidden: T1/T2 only" }, { status: 403 });
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await resolveMerch(ctx.store, ctx.userId, { reservation_id: id, ...parsed.data }), "resolution");
}
