import { NextResponse } from "next/server";
import { z } from "zod";
import { clubAdmin } from "@/lib/server/clubAdmin";

/** GET /api/admin/attendance: in-person events from the last four months and ahead, newest first, with how many checked in. */
export async function GET() {
  const ctx = await clubAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const since = new Date(Date.now() - 120 * 864e5).toISOString();
  const { data, error } = await ctx.db.from("events")
    .select("id, title, start_time, end_time, location, event_attendance(status)")
    .eq("is_irl", true).eq("status", "approved").gte("start_time", since)
    .order("start_time", { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: "Couldn't load events." }, { status: 503 });
  const events = (data ?? []).map(({ event_attendance, ...e }) => ({
    ...e, attended: ((event_attendance ?? []) as { status: string }[]).filter((a) => a.status === "attended").length,
  }));
  return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
}

const NewEvent = z.object({
  title: z.string().trim().min(1).max(200),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
});

/**
 * POST /api/admin/attendance: a new in-person club event. It's an ordinary approved event (it shows in the game's
 * calendar too), so the existing check-in route and attendance triggers handle the scan and the rewards.
 */
export async function POST(request: Request) {
  const ctx = await clubAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const body = NewEvent.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Give the event a title and a start time." }, { status: 400 });
  // events.created_by references profiles; an admin without a game profile leaves it empty.
  const { data: profile } = await ctx.db.from("profiles").select("id").eq("id", ctx.user.id).maybeSingle();
  const { data, error } = await ctx.db.from("events").insert({
    ...body.data, location: body.data.location || null, event_type: "club", is_irl: true, status: "approved",
    created_by: profile?.id ?? null, approved_by: profile?.id ?? null,
  }).select("id, title, start_time, end_time, location").single();
  if (error) return NextResponse.json({ error: "Couldn't create the event." }, { status: 503 });
  return NextResponse.json({ event: { ...data, attended: 0 } }, { status: 201 });
}
