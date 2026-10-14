import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, jsonResult, withStore } from "@/lib/server/memberContext";
import { notifyRealtime } from "@/lib/server/realtimeNotify";
import { addFriend, friendsView, removeFriend, respondFriend, type FriendStore } from "@/lib/world/friends";
import { supabaseFriendStore } from "@/lib/world/friendsSupabase";
import { devActor, devFriends } from "@/lib/world/devWorld";

// Your friends (v1, specs/v1-drop.md §3): your friend code, your friends and your requests both ways. Any signed-in
// account; world names only. A friendship made or ended is told to the realtime server at once (POST /internal/friend),
// so both players' lists (and Join) change in the island now.
//   GET                                  → { ok, friends: { code, friends, incoming, outgoing } }
//   POST   { member_id } | { code }      → ask (asking someone who asked you is the accept) → { ok, status, member_id, friends, realtime? }
//   PATCH  { member_id, accept }         → say yes or no to their request → { ok, status, friends, realtime? }
//   DELETE ?member_id=<uuid>             → unfriend, or take back a request → { ok, was, friends, realtime? }
// `realtime`: applied, skipped (no realtime server configured) or failed (from the next join).
const Member = z.string().uuid();
const Add = z.union([z.strictObject({ member_id: Member }), z.strictObject({ code: z.string().max(40) })]);
const Respond = z.strictObject({ member_id: Member, accept: z.boolean() });

/** Who's asking, with their friends' records: Supabase, or the local bench's memory for a dev token (lib/world/devWorld). */
async function context(request: Request): Promise<{ userId: string; store: FriendStore } | NextResponse> {
  const dev = devActor(request);
  if (dev) return { userId: dev.userId, store: devFriends(dev) };
  return withStore(supabaseFriendStore);
}
const tell = (a: string, b: string, friends: boolean) => notifyRealtime("/internal/friend", { a_id: a, b_id: b, friends });

export async function GET(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await friendsView(ctx.store, ctx.userId), "friends");
}

export async function POST(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Add.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const input = "member_id" in parsed.data ? { member_id: parsed.data.member_id.toLowerCase() } : { code: parsed.data.code };
  const r = await addFriend(ctx.store, ctx.userId, input);
  if (!r.ok) return jsonResult(r, "friends");
  const realtime = r.data.status === "friends" ? await tell(ctx.userId, r.data.member_id, true) : undefined;
  return NextResponse.json({ ok: true, status: r.data.status, member_id: r.data.member_id, friends: r.data.view, ...(realtime ? { realtime } : {}) });
}

export async function PATCH(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Respond.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const from = parsed.data.member_id.toLowerCase();
  const r = await respondFriend(ctx.store, ctx.userId, from, parsed.data.accept);
  if (!r.ok) return jsonResult(r, "friends");
  const realtime = r.data.status === "friends" ? await tell(ctx.userId, from, true) : undefined;
  return NextResponse.json({ ok: true, status: r.data.status, friends: r.data.view, ...(realtime ? { realtime } : {}) });
}

export async function DELETE(request: Request) {
  const ctx = await context(request);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Member.safeParse(new URL(request.url).searchParams.get("member_id"));
  if (!parsed.success) return badRequest();
  const other = parsed.data.toLowerCase();
  const r = await removeFriend(ctx.store, ctx.userId, other);
  if (!r.ok) return jsonResult(r, "friends");
  const realtime = r.data.was ? await tell(ctx.userId, other, false) : undefined;
  return NextResponse.json({ ok: true, was: r.data.was, friends: r.data.view, ...(realtime ? { realtime } : {}) });
}
