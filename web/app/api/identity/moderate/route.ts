import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { jsonResult } from "@/lib/server/memberContext";
import { withAdminStore } from "@/lib/server/adminContext";
import { moderate } from "@/lib/identity/service";

// POST /api/identity/moderate { member_id, action: mute | unmute | reset_name | dismiss } (T1/T2, row 221). Closes that member's open name reports.
export async function POST(request: Request) {
  const ctx = await withAdminStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ member_id: z.string().uuid(), action: z.enum(["mute", "unmute", "reset_name", "dismiss"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await moderate(ctx.store, ctx.userId, ctx.tier, parsed.data.member_id, parsed.data.action, ctx.now), "moderation");
}
