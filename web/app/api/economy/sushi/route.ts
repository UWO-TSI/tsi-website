import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { IdemKey, jsonResult, withStore } from "@/lib/server/memberContext";
import { orderDish, sushiView } from "@/lib/wallet/service";

const Body = z.object({ dish: z.string().regex(/^[a-z0-9_]{1,64}$/), fish: z.string().regex(/^[a-z0-9_]{1,64}$/).optional(), idempotency_key: IdemKey });

// GET /api/economy/sushi: the sushi bar's menu and your meal's buff.
export async function GET() {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await sushiView(ctx.store, ctx.userId, new Date()), "sushi");
}

// POST /api/economy/sushi: order a dish (coins), or the feast (`fish`: one of your epic or legendary fish); retry with the same key.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await orderDish(ctx.store, ctx.userId, parsed.data, new Date()), "order");
}
