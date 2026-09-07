import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPresenceCoordinate } from "@/lib/game/presencePosition";

// POST /api/emotes/log
// Body: { emote_type_id: string; world_x: number; world_z: number }
// Auth required. Uses RLS-enforced authenticated client (not service role).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: { emote_type_id?: unknown; world_x?: unknown; world_z?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const emoteId =
    typeof body.emote_type_id === "string" ? body.emote_type_id.trim() : "";
  const worldX = typeof body.world_x === "number" ? body.world_x : NaN;
  const worldZ = typeof body.world_z === "number" ? body.world_z : NaN;

  if (!UUID_RE.test(emoteId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid emote_type_id" },
      { status: 400 },
    );
  }
  if (!isPresenceCoordinate(worldX) || !isPresenceCoordinate(worldZ)) {
    return NextResponse.json(
      { ok: false, error: "Invalid world coordinates" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { error } = await supabase.from("emote_logs").insert({
    user_id: user.id,
    emote_type_id: emoteId,
    world_x: worldX,
    world_z: worldZ,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Emote sharing unavailable" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
