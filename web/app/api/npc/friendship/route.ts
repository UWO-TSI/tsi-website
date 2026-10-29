import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, memberContext } from "@/lib/server/memberContext";
import { friendLetter, giftTaste, heartsReached, TASTE_HALVES, type Taste } from "@/lib/npc/friendship";
import { itemInfo } from "@/lib/collections/bag";

// GET /api/npc/friendship: your friendship with each resident, in half hearts ({ slug: 0..10 }).
export async function GET() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.db.from("resident_friendships").select("resident, level").eq("member_id", ctx.userId);
  if (error) return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, friends: Object.fromEntries((data ?? []).map(r => [r.resident, r.level])) });
}

const Body = z.object({ resident: z.string().regex(/^[a-z0-9-]{1,64}$/), gift: z.string().regex(/^[a-z0-9_-]{1,64}$/).optional() });
const REFUSED: Record<string, [number, string]> = {
  not_found: [404, "No such resident."],
  gift_done: [409, "They've had a gift from you today. Come back tomorrow!"],
  none_left: [409, "You don't have that one to give."],
};

/**
 * POST /api/npc/friendship { resident }: a whole talk heard (its last line read, TalkBox); the day's first adds half a heart (once a day, server-side).
 * POST /api/npc/friendship { resident, gift }: give one of an item from your bag (one gift a day per resident); its taste
 * (the roster's, judged here) moves the friendship. Each whole heart newly reached sends its letter (odd hearts) or pays
 * its coins (even hearts, in the database).
 */
export async function POST(request: Request) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { resident, gift } = parsed.data;
  let taste: Taste | null = null;
  if (gift) {
    const info = itemInfo(gift);
    if (!info) return NextResponse.json({ ok: false, error: "That can't be given.", code: "not_giftable" }, { status: 400 });
    taste = giftTaste(resident, gift, info.category);
  }
  const { data, error } = gift
    ? await ctx.db.rpc("resident_friend_gift", { p_member_id: ctx.userId, p_resident: resident, p_item_key: gift, p_delta: TASTE_HALVES[taste!] })
    : await ctx.db.rpc("resident_friend_talk", { p_member_id: ctx.userId, p_resident: resident });
  if (error) {
    const code = Object.keys(REFUSED).find(c => error.message.includes(c));
    return code ? NextResponse.json({ ok: false, error: REFUSED[code][1], code }, { status: REFUSED[code][0] })
      : NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  }
  const r = (Array.isArray(data) ? data[0] : data) as { was: number; level: number; coins: number };
  const { data: persona } = await ctx.db.from("npc_personas").select("display_name").eq("slug", resident).maybeSingle();
  const name = persona?.display_name ?? resident;
  // Each letter is keyed per resident and heart, so a retry, or a heart lost and won back, never sends it twice.
  const letters = heartsReached(r.was, r.level).flatMap(h => { const l = friendLetter(h, name); return l ? [{ ...l, heart: h }] : []; });
  for (const l of letters) await ctx.db.from("letters").upsert({ kind: "system", recipient_id: ctx.userId, subject: l.subject, body: l.body, broadcast_key: `friend:${resident}:${l.heart}` },
    { onConflict: "broadcast_key,recipient_id", ignoreDuplicates: true });
  return NextResponse.json({ ok: true, friend: { resident, name, was: r.was, level: r.level, coins: r.coins, letter: letters.length > 0, taste } });
}
