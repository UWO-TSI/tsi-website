import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { badRequest, jsonResult } from "@/lib/server/memberContext";
import { withAdminStore } from "@/lib/server/adminContext";
import { resolveMerch } from "@/lib/wallet/service";

const Body = z.object({ action: z.enum(["fulfil", "cancel"]), note: z.string().max(200).optional() });

// POST /api/economy/admin/merch/:id (T1/T2): fulfil (picked up) or cancel (Gems refunded, stock returned). Retry-safe.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAdminStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return badRequest();
  return jsonResult(await resolveMerch(ctx.store, ctx.userId, { reservation_id: id, ...parsed.data }), "resolution");
}
