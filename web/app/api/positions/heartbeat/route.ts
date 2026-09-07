import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPresenceCoordinate } from "@/lib/game/presencePosition";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !isPresenceCoordinate(body.world_x) || !isPresenceCoordinate(body.world_z)) {
    return NextResponse.json({ error: "coords out of range" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("player_positions")
    .upsert({
      user_id: user.id,
      world_x: body.world_x,
      world_z: body.world_z,
      recorded_at: nowIso,
    });
  if (error) return NextResponse.json({ error: "Presence update unavailable" }, { status: 503 });

  // Await the builder so the optional last-seen update actually executes.
  try {
    const { error: profileError } = await supabase.from("profiles").update({ last_seen_at: nowIso }).eq("id", user.id);
    if (profileError) console.warn("[positions/heartbeat] Last-seen metadata update failed");
  } catch {
    console.warn("[positions/heartbeat] Last-seen metadata update failed");
  }

  return NextResponse.json({ ok: true });
}
