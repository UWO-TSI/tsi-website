import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/leaderboard — top N profiles sorted by XP desc, with rank numbers
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  // Get top players by XP
  const { data: players, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, tier, position, class, subclass, level, xp, rank, is_active"
    )
    .eq("is_active", true)
    .order("xp", { ascending: false })
    .order("level", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add rank numbers
  const leaderboard = (players ?? []).map((player, index) => ({
    rank_position: index + 1,
    ...player,
  }));

  // Find the requesting user's rank
  const userEntry = leaderboard.find((p) => p.id === user.id);
  let userRank = userEntry?.rank_position ?? null;

  // If user isn't in the top N, find their actual rank
  if (!userEntry) {
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("xp")
      .eq("id", user.id)
      .single();

    if (userProfile) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .gt("xp", userProfile.xp);

      userRank = (count ?? 0) + 1;
    }
  }

  return NextResponse.json({
    leaderboard,
    your_rank: userRank,
    total_returned: leaderboard.length,
  });
}
