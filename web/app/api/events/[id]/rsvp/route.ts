import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/events/[id]/rsvp — toggle RSVP (register or un-register)
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify event exists and is approved
  const { data: event } = await supabase
    .from("events")
    .select("id, title, status")
    .eq("id", id)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "approved") {
    return NextResponse.json({ error: "Event is not active" }, { status: 400 });
  }

  // Check if already RSVPed
  const { data: existing } = await supabase
    .from("event_attendance")
    .select("id")
    .eq("event_id", id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Un-RSVP
    const { error } = await supabase
      .from("event_attendance")
      .delete()
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      action: "unregistered",
      event_id: id,
      event_title: event.title,
    });
  }

  // RSVP
  const { error } = await supabase
    .from("event_attendance")
    .insert({
      event_id: id,
      user_id: user.id,
      status: "registered",
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    action: "registered",
    event_id: id,
    event_title: event.title,
  });
}
