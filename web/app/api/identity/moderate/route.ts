import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { badRequest, jsonResult } from "@/lib/server/memberContext";
import { withAdminStore } from "@/lib/server/adminContext";
import { logModeration, unlogged } from "@/lib/server/moderationLog";
import { notifyRealtime } from "@/lib/server/realtimeNotify";
import { moderate, MUTE_DAYS } from "@/lib/identity/service";

// POST /api/identity/moderate { member_id, action, days? } (T1/T2, row 221; world removal M2):
// - mute (days, default 7) | unmute | reset_name | dismiss: as before. Closes that member's open name reports (not
//   unmute); every action goes in the audit log with the name it was about. A mute or unmute also reaches the island
//   at once.
// - remove (days 1–365, default 7) | restore: out of the multiplayer world until then (closed now with 4102, rejoins
//   refused) or back in, through realtime_sanction (the audit row in the same transaction: remove_world /
//   restore_world). Refused for yourself and for T1/T2 (409 staff).
// `realtime`: applied | skipped (no realtime server configured) | failed (the server's 60 s poll applies it).
const Body = z.object({
  member_id: z.string().uuid(),
  action: z.enum(["mute", "unmute", "reset_name", "dismiss", "remove", "restore"]),
  days: z.number().int().min(1).max(365).optional(),
});

const SANCTION_ERRORS: Record<string, [number, string]> = {
  forbidden: [403, "T1/T2 only."],
  not_found: [404, "Member not found."],
  self: [400, "You can't remove yourself."],
  staff: [409, "T1/T2 can't be removed from the world."],
  invalid: [400, "Invalid request"],
};

export async function POST(request: Request) {
  const ctx = await withAdminStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { member_id, action, days } = parsed.data;
  const target = member_id.toLowerCase();

  if (action === "remove" || action === "restore") {
    const { data, error } = await ctx.db.rpc("realtime_sanction", { p_actor: ctx.userId, p_member: target, p_action: action, p_days: action === "remove" ? (days ?? MUTE_DAYS) : null });
    if (error) {
      const known = Object.keys(SANCTION_ERRORS).find((c) => error.message === c || error.message?.includes(c));
      const [status, message] = known ? SANCTION_ERRORS[known] : [500, "Something went wrong. Try again."];
      return NextResponse.json({ ok: false, code: known ?? "failed", error: message }, { status });
    }
    const removed_until = ((data ?? {}) as { removed_until?: string | null }).removed_until ?? null;
    const realtime = await notifyRealtime("/internal/sanction", { member_id: target, removed_until });
    return NextResponse.json({ ok: true, moderation: { action, removed_until, realtime } });
  }

  const { data: named } = await ctx.db.from("member_identity").select("world_name").eq("member_id", target).maybeSingle();
  const r = await moderate(ctx.store, ctx.userId, ctx.tier, target, action, ctx.now, action === "mute" ? (days ?? MUTE_DAYS) : MUTE_DAYS);
  if (r.ok && !(await logModeration(ctx.db, ctx.userId, { action, item_kind: action === "unmute" ? "member" : "name", target_id: target, excerpt: (named?.world_name as string | null) ?? null }))) return unlogged();
  if (!r.ok || r.data.muted_until === undefined) return jsonResult(r, "moderation");
  const realtime = await notifyRealtime("/internal/sanction", { member_id: target, muted_until: r.data.muted_until });
  return NextResponse.json({ ok: true, moderation: { ...r.data, realtime } });
}
