import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  // Quest completion grants nothing per design principle #3 (David ruling
  // 2026-07-01): XP is IRL-event-check-in-only, TC is money-value-work-only.
  // Completing an online quest is neither. The route still tracks completion
  // status; xp_reward / tc_reward columns are inert (same treatment as
  // bounties.xp_reward in the 5e5372a ruling). Pre-pivot quest system has no
  // UI callers as of 2026-07-02.
  const { data: quest } = await supabase
    .from("quests")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!quest) {
    return NextResponse.json({ error: "Quest not found" }, { status: 404 });
  }

  // Verify user has accepted this quest and it's not already completed
  const { data: progress } = await supabase
    .from("quest_progress")
    .select("id, status")
    .eq("quest_id", id)
    .eq("user_id", user.id)
    .single();

  if (!progress) {
    return NextResponse.json(
      { error: "You haven't accepted this quest" },
      { status: 400 }
    );
  }

  if (progress.status === "completed") {
    return NextResponse.json(
      { error: "Quest already completed" },
      { status: 409 }
    );
  }

  // Mark quest complete
  await supabase
    .from("quest_progress")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", progress.id);

  // No awardRewards call — completion is status-only per principle #3.
  return NextResponse.json({
    completed: true,
    rewards: null,
  });
}
