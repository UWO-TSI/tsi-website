import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardRewards } from "@/lib/supabase/helpers";

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

  // Get quest details for rewards
  const { data: quest } = await supabase
    .from("quests")
    .select("id, title, xp_reward, tc_reward")
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

  // Award rewards (auto-levels up)
  const result = await awardRewards(supabase, user.id, {
    coins: quest.tc_reward ?? 0,
    xp: quest.xp_reward ?? 0,
    coinType: "earn_quest",
    xpType: "quest",
    referenceId: id,
    description: `Quest completed: ${quest.title}`,
  });

  return NextResponse.json({
    completed: true,
    rewards: result
      ? {
          coins: quest.tc_reward ?? 0,
          xp: quest.xp_reward ?? 0,
          new_balance: result.tethos_coins,
          new_xp: result.xp,
          new_level: result.level,
          new_rank: result.rank,
        }
      : null,
  });
}
