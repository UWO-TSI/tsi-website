import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, memberContext } from "@/lib/server/memberContext";
import { friendLetter } from "@/lib/npc/friendship";

// GET /api/npc/friendship: your friendship level with each resident ({ slug: level }).
export async function GET() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const { data, error } = await ctx.db.from("resident_friendships").select("resident, level").eq("member_id", ctx.userId);
  if (error) return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, friends: Object.fromEntries((data ?? []).map(r => [r.resident, r.level])) });
}

const Talked = z.object({ resident: z.string().regex(/^[a-z0-9-]{1,64}$/) });
// POST /api/npc/friendship { resident }: a talk ended; the day's first raises the level (once a day, server-side).
export async function POST(request: Request) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Talked.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const { resident } = parsed.data;
  const { data, error } = await ctx.db.rpc("resident_friend_talk", { p_member_id: ctx.userId, p_resident: resident });
  if (error) return error.message.includes("not_found")
    ? NextResponse.json({ ok: false, error: "No such resident.", code: "not_found" }, { status: 404 })
    : NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  const r = (Array.isArray(data) ? data[0] : data) as { level: number; leveled: boolean; coins: number };
  const { data: persona } = await ctx.db.from("npc_personas").select("display_name").eq("slug", resident).maybeSingle();
  const name = persona?.display_name ?? resident;
  const letter = r.leveled ? friendLetter(r.level, name) : null;
  // The letter is keyed per resident and level, so a retry never sends it twice.
  if (letter) await ctx.db.from("letters").upsert({ kind: "system", recipient_id: ctx.userId, subject: letter.subject, body: letter.body, broadcast_key: `friend:${resident}:${r.level}` },
    { onConflict: "broadcast_key,recipient_id", ignoreDuplicates: true });
  return NextResponse.json({ ok: true, friend: { resident, name, level: r.level, leveled: r.leveled, coins: r.coins, letter: !!letter } });
}
