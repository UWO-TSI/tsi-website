import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("player_positions")
    .select("user_id, world_x, world_z, recorded_at, profiles!inner(display_name, level)")
    .neq("user_id", user.id)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(10);
  if (error) return NextResponse.json({ ghosts: [] });

  const ghosts = (data ?? []).map((row: unknown) => {
    const r = row as { user_id: string; world_x: number; world_z: number; recorded_at: string; profiles?: { display_name?: string; level?: number } };
    return {
      user_id: r.user_id,
      world_x: r.world_x,
      world_z: r.world_z,
      recorded_at: r.recorded_at,
      display_name: r.profiles?.display_name ?? "Visitor",
      level: r.profiles?.level ?? 1,
    };
  });
  return NextResponse.json({ ghosts });
}
