import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, memberContext } from "@/lib/server/memberContext";
import { CLIENT_STEPS, FEATURES, SCREENS } from "@/lib/analytics/steps";

/** Per member: at most this many events a minute land (a tab sends a handful; the rest is a loop or abuse). */
export const PER_MINUTE = 40;
const MAX_AGO = 15 * 60_000;

const Event = z.object({
  kind: z.enum(["session_start", "heartbeat", "session_end", "step", "feature"]),
  step: z.string().optional(),
  screen: z.enum(SCREENS).optional(),
  ago: z.number().int().min(0).max(MAX_AGO),
}).refine((e) => e.kind === "step" ? CLIENT_STEPS.includes(e.step as never) : e.kind === "feature" ? FEATURES.includes(e.step as never) : e.step === undefined);
const Body = z.object({ session: z.uuid(), events: z.array(Event).min(1).max(25) });

// POST /api/analytics/events: a batch from lib/analytics/track.ts (fetch, or a beacon on pagehide). Ids only, from
// lib/analytics/steps.ts; the time is the server's, less how long the event waited in the tab.
export async function POST(req: Request) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const now = ctx.now.getTime();
  const { count, error } = await ctx.db.from("game_events").select("id", { count: "exact", head: true })
    .eq("member_id", ctx.userId).gte("at", new Date(now - 60_000).toISOString());
  if (error) return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  const room = PER_MINUTE - (count ?? 0);
  if (room <= 0) return NextResponse.json({ ok: false, error: "Slow down." }, { status: 429 });
  const rows = parsed.data.events.slice(0, room).map((e) => ({
    member_id: ctx.userId, session_id: parsed.data.session, kind: e.kind, step: e.step ?? null, screen: e.screen ?? null,
    at: new Date(now - e.ago).toISOString(),
  }));
  const { error: insertError } = await ctx.db.from("game_events").insert(rows);
  if (insertError) return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true, kept: rows.length });
}
