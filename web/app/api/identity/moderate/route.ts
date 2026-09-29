import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { jsonResult } from "@/lib/server/memberContext";
import { withAdminStore } from "@/lib/server/adminContext";
import { logModeration, unlogged } from "@/lib/server/moderationLog";
import { moderate } from "@/lib/identity/service";

// POST /api/identity/moderate { member_id, action: mute | unmute | reset_name | dismiss } (T1/T2, row 221).
// Closes that member's open name reports (not unmute); every action goes in the audit log with the name it was about.
export async function POST(request: Request) {
  const ctx = await withAdminStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ member_id: z.string().uuid(), action: z.enum(["mute", "unmute", "reset_name", "dismiss"]) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  const { member_id, action } = parsed.data;
  const { data: named } = await ctx.db.from("member_identity").select("world_name").eq("member_id", member_id).maybeSingle();
  const r = await moderate(ctx.store, ctx.userId, ctx.tier, member_id, action, ctx.now);
  if (r.ok && !(await logModeration(ctx.db, ctx.userId, { action, item_kind: action === "unmute" ? "member" : "name", target_id: member_id, excerpt: (named?.world_name as string | null) ?? null }))) return unlogged();
  return jsonResult(r, "moderation");
}
