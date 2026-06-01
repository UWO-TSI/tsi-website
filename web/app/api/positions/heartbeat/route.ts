import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.world_x !== "number" || typeof body.world_z !== "number") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (Math.abs(body.world_x) > 50 || Math.abs(body.world_z) > 50) {
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Touch last_seen_at on the profile so "world remembers me" features
  // (returning-player greeting, login streak) have fresh data. Fire and
  // forget — failure here doesn't break the position heartbeat.
  void supabase.from("profiles").update({ last_seen_at: nowIso }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
