import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { badRequest } from "@/lib/server/memberContext";
import { withAdminStore } from "@/lib/server/adminContext";

// POST /api/economy/admin/award { user_id, amount, description? } (T1/T2): Gems to a member
// through wallet_apply (locked, recorded). Was the "award" action inside /api/economy.
const Body = z.object({ user_id: z.string().uuid(), amount: z.number().int().min(1).max(100000), description: z.string().max(200).optional() });

export async function POST(request: Request) {
  const ctx = await withAdminStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { user_id, amount, description } = parsed.data;
  const { data: target } = await ctx.db.from("profiles").select("id").eq("id", user_id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  try {
    const { balance } = await ctx.store.credit(user_id, "gems", amount, "earn_admin", description ?? `Admin award by ${ctx.userId}`, `award:${crypto.randomUUID()}`);
    return NextResponse.json({ success: true, user: user_id, awarded: amount, new_balance: balance });
  } catch {
    return NextResponse.json({ error: "Failed to award" }, { status: 500 });
  }
}
