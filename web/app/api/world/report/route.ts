import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, jsonResult, withStore } from "@/lib/server/memberContext";
import { supabaseWorldStore } from "@/lib/world/supabaseStore";
import { reportWorld } from "@/lib/world/service";

// POST /api/world/report { line_id | member_id, room_id?, reason }: report a world chat line (its id from the `line`
// message) or a player from the roster (room_id: your room, for the chat context). Any signed-in account, members and
// public alike; at most 5 an hour. Lands in the T1/T2 queue with the room's last 20 lines (specs/multiplayer.md §6).
const Body = z
  .strictObject({
    line_id: z.string().uuid().optional(),
    member_id: z.string().uuid().optional(),
    room_id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
    reason: z.string().trim().min(1).max(200),
  })
  .refine((b) => (b.line_id ? 1 : 0) + (b.member_id ? 1 : 0) === 1, "a line_id or a member_id");

export async function POST(request: Request) {
  const ctx = await withStore(supabaseWorldStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { line_id, member_id, room_id, reason } = parsed.data;
  return jsonResult(await reportWorld(ctx.store, ctx.userId, { line_id: line_id?.toLowerCase(), member_id: member_id?.toLowerCase(), room_id, reason }, ctx.now), "report");
}
