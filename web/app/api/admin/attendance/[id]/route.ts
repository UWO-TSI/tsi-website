import { NextResponse } from "next/server";
import { z } from "zod";
import { clubAdmin } from "@/lib/server/clubAdmin";
import { checkInUrl } from "@/lib/portal/checkIn";

/** GET /api/admin/attendance/:id: the event's check-in link (for its QR) and who has checked in. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await clubAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Bad event id." }, { status: 400 });
  const [event, people] = await Promise.all([
    ctx.db.from("events").select("id, title, start_time, end_time, location, qr_check_in_code").eq("id", id).maybeSingle(),
    ctx.db.from("event_attendance").select("profiles(display_name, email)").eq("event_id", id).eq("status", "attended"),
  ]);
  if (event.error || people.error) return NextResponse.json({ error: "Couldn't load the event." }, { status: 503 });
  if (!event.data) return NextResponse.json({ error: "No such event." }, { status: 404 });
  const { qr_check_in_code: code, ...rest } = event.data;
  const attendees = (people.data ?? [])
    .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { display_name: string; email: string } | null)
    .filter((p): p is { display_name: string; email: string } => !!p)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
  return NextResponse.json({ event: rest, url: code ? checkInUrl(id, code) : null, attendees }, { headers: { "Cache-Control": "no-store" } });
}
