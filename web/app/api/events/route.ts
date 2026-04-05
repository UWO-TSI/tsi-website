import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// GET /api/events — list events with optional date range and type filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get("type");
  const from = searchParams.get("from"); // ISO date
  const to = searchParams.get("to"); // ISO date
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  let query = supabase
    .from("events")
    .select("*, event_attendance(user_id, status)")
    .eq("status", "approved")
    .order("start_time", { ascending: true })
    .limit(limit);

  if (eventType) {
    query = query.eq("event_type", eventType);
  }

  if (from) {
    query = query.gte("start_time", from);
  }

  if (to) {
    query = query.lte("start_time", to);
  }

  const { data: events, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Annotate each event with user's RSVP status and attendee count
  const result = (events ?? []).map((event) => {
    const attendance = (event.event_attendance ?? []) as { user_id: string; status: string }[];
    const userRsvp = attendance.find((a) => a.user_id === user.id);
    return {
      ...event,
      attendee_count: attendance.length,
      user_rsvp: userRsvp?.status ?? null,
      event_attendance: undefined, // Don't expose raw attendance list
    };
  });

  return NextResponse.json({ events: result });
}

// POST /api/events — create an event (T1-T3 only)
const CreateEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  event_type: z.enum(["club", "team", "bounty", "volunteer", "social", "workshop", "meeting"]),
  start_time: z.string().datetime(),
  end_time: z.string().datetime().nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  is_all_day: z.boolean().optional().default(false),
  tc_reward: z.number().int().min(0).max(10000).optional().default(0),
  xp_reward: z.number().int().min(0).max(10000).optional().default(0),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only T1-T3 can create events
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!profile || profile.tier > 3) {
    return NextResponse.json({ error: "Forbidden — T1-T3 only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      ...parsed.data,
      status: "approved", // T1-T3 events auto-approved
      created_by: user.id,
      approved_by: user.id,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ event }, { status: 201 });
}
