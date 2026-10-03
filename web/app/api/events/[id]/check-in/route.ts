import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, memberContext } from "@/lib/server/memberContext";
import { adminContext } from "@/lib/server/adminContext";
import { checkInUrl } from "@/lib/portal/checkIn";

const Id = z.string().uuid();
const Body = z.object({ code: z.string().uuid() });
const refuse = (status: number, error: string, code: string) => NextResponse.json({ ok: false, error, code }, { status });
const unavailable = () => refuse(503, "Check-in isn’t available right now. Try again in a moment.", "unavailable");

/**
 * POST /api/events/:id/check-in {code}: a member scanned the event's QR at the door (row 11: in-person attendance is
 * the XP that can't be earned online). The code must be the event's; members only. Writes attendance as the server
 * (members can only RSVP, 20260926155200), so the attendance triggers pay the event's coins and XP, once per row
 * (economy_event_attendance_credit, combat_event_attendance_xp, keyed by the row). Scanning again is a no-op.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success || !Id.safeParse(id).success) return badRequest("That check-in link isn’t complete. Scan the QR code at the door again.");
  if (ctx.tier > 4) return refuse(403, "Check-in is for club members.", "not_member");

  const { data: event, error } = await ctx.db.from("events").select("id, title, status, is_irl, qr_check_in_code").eq("id", id).maybeSingle();
  if (error) return unavailable();
  if (!event || event.status !== "approved") return refuse(404, "We couldn’t find that event.", "not_found");
  if (event.qr_check_in_code !== body.data.code) return refuse(403, "That code isn’t this event’s. Scan the QR code at the door again.", "wrong_code");

  const done = (already: boolean) => NextResponse.json({ ok: true, event: { id: event.id, title: event.title, is_irl: event.is_irl }, already });
  const { data: row, error: readError } = await ctx.db.from("event_attendance").select("id, status").eq("event_id", id).eq("user_id", ctx.userId).maybeSingle();
  if (readError) return unavailable();
  if (row?.status === "attended") return done(true);
  const write = row
    ? await ctx.db.from("event_attendance").update({ status: "attended" }).eq("id", row.id).neq("status", "attended")
    : await ctx.db.from("event_attendance").insert({ event_id: id, user_id: ctx.userId, status: "attended" });
  if (write.error) return write.error.code === "23505" ? done(true) : unavailable(); // another scan got there first
  return done(false);
}

/** GET /api/events/:id/check-in (T1/T2): the event's QR link for the editor and the door poster (members can't read the code). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!Id.safeParse(id).success) return badRequest();
  const { data, error } = await ctx.db.from("events").select("id, qr_check_in_code").eq("id", id).maybeSingle();
  if (error) return unavailable();
  if (!data) return refuse(404, "We couldn’t find that event.", "not_found");
  const code = data.qr_check_in_code as string | null;
  return NextResponse.json({ ok: true, code, url: code ? checkInUrl(id, code) : null });
}
