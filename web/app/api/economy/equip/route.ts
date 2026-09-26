import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { equip } from "@/lib/wallet/service";

const Body = z.object({ item_id: z.string().uuid(), equipped: z.boolean() });

// POST /api/economy/equip: one equipped item per slot (rod, net, shovel, outfit, hair, accessory).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await equip(ctx.store, ctx.userId, parsed.data), "inventory");
}
