import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Sprint F1.3 — combined "server list" for the hold-Tab overlay.
 * Returns recent player positions split into online/recent, all active
 * NPCs, and events starting within the next hour.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const oneHourAhead = new Date(Date.now() + 60 * 60_000).toISOString();

  const [positions, npcs, events] = await Promise.all([
    supabase
      .from("player_positions")
      .select("user_id, recorded_at, profiles!inner(display_name, level, class, tier)")
      .gte("recorded_at", oneDayAgo)
      .order("recorded_at", { ascending: false })
      .limit(50),
    supabase
      .from("npc_personas")
      .select("id, display_name, spawn_zone, is_permanent")
      .eq("active", true)
      .order("display_name"),
    supabase
      .from("events")
      .select("id, title, start_time, location")
      .gte("start_time", new Date().toISOString())
      .lte("start_time", oneHourAhead)
      .order("start_time")
      .limit(10),
  ]);

  type RawPos = {
    user_id: string;
    recorded_at: string;
    profiles?: { display_name?: string; level?: number; class?: string | null; tier?: number };
  };
  const positionsData = (positions.data ?? []) as unknown as RawPos[];

  type OnlineItem = {
    user_id: string;
    display_name: string;
    level: number;
    class: string | null;
    tier: number;
    recorded_at: string;
  };
  const online: OnlineItem[] = [];
  const recent: OnlineItem[] = [];
  const seen = new Set<string>();
  for (const row of positionsData) {
    // dedupe by user_id — keep newest (already ordered desc)
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    const item: OnlineItem = {
      user_id: row.user_id,
      display_name: row.profiles?.display_name ?? "Visitor",
      level: row.profiles?.level ?? 1,
      class: row.profiles?.class ?? null,
      tier: row.profiles?.tier ?? 5,
      recorded_at: row.recorded_at,
    };
    if (row.recorded_at >= fiveMinAgo) online.push(item);
    else recent.push(item);
  }

  return NextResponse.json({
    online,
    recent: recent.slice(0, 10),
    npcs: npcs.data ?? [],
    events: events.data ?? [],
  });
}
