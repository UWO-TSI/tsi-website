import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, jsonResult, withStore } from "@/lib/server/memberContext";
import { notifyRealtime } from "@/lib/server/realtimeNotify";
import { supabaseWorldStore } from "@/lib/world/supabaseStore";
import { blockPlayer, listBlocks, unblockPlayer } from "@/lib/world/service";

// Your world chat blocks (specs/multiplayer.md §6): the realtime server stops chat lines and emotes between you and a
// blocked player, both ways; avatars still show. Any signed-in account.
//   GET                          → { ok, blocks: [{ member_id, world_name, created_at }] }
//   POST   { member_id }         → block (again is fine)   → { ok, blocks, realtime }
//   DELETE ?member_id=<uuid>     → unblock (not blocked is fine) → { ok, blocks, realtime }
// `realtime`: applied (in effect in the island now), skipped (no realtime server configured) or failed (from the
// next join).
const Member = z.string().uuid();

export async function GET() {
  const ctx = await withStore(supabaseWorldStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await listBlocks(ctx.store, ctx.userId), "blocks");
}

export async function POST(request: Request) {
  const ctx = await withStore(supabaseWorldStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.strictObject({ member_id: Member }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const target = parsed.data.member_id.toLowerCase();
  const r = await blockPlayer(ctx.store, ctx.userId, target);
  if (!r.ok) return jsonResult(r, "blocks");
  const realtime = await notifyRealtime("/internal/block", { blocker_id: ctx.userId, blocked_id: target, blocked: true });
  return NextResponse.json({ ok: true, blocks: r.data, realtime });
}

export async function DELETE(request: Request) {
  const ctx = await withStore(supabaseWorldStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Member.safeParse(new URL(request.url).searchParams.get("member_id"));
  if (!parsed.success) return badRequest();
  const target = parsed.data.toLowerCase();
  const r = await unblockPlayer(ctx.store, ctx.userId, target);
  if (!r.ok) return jsonResult(r, "blocks");
  const realtime = await notifyRealtime("/internal/block", { blocker_id: ctx.userId, blocked_id: target, blocked: false });
  return NextResponse.json({ ok: true, blocks: r.data, realtime });
}
