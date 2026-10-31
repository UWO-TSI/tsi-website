import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { enterMonthly, monthBoard } from "@/lib/collections/service";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";

const Body = z.object({ item_key: z.string().regex(/^[a-z0-9_]{1,64}$/), idempotency_key: IdemKey });

// GET /api/collections/monthly: this month's board (each fish's biggest entry) and the fish you could put up.
export async function GET() {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await monthBoard(ctx.store, ctx.userId, ctx.now), "monthly");
}

// POST /api/collections/monthly: put one of a fish you landed this month on the board; retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await enterMonthly(ctx.store, ctx.userId, parsed.data), "entry");
}
