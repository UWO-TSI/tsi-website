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

  // Award rewards
  const { data: profile } = await supabase
    .from("profiles")
    .select("tethos_coins, xp")
    .eq("id", user.id)
    .single();

  if (profile) {
    const newCoins = profile.tethos_coins + (quest.tc_reward ?? 0);
    const newXp = profile.xp + (quest.xp_reward ?? 0);

    await supabase
      .from("profiles")
      .update({ tethos_coins: newCoins, xp: newXp })
      .eq("id", user.id);

    // Record transactions
    if (quest.tc_reward && quest.tc_reward > 0) {
      await supabase.from("tc_transactions").insert({
        user_id: user.id,
        amount: quest.tc_reward,
        balance_after: newCoins,
        type: "earn_quest",
        reference_id: id,
        description: `Quest completed: ${quest.title}`,
      });
    }

    if (quest.xp_reward && quest.xp_reward > 0) {
      await supabase.from("xp_transactions").insert({
        user_id: user.id,
        amount: quest.xp_reward,
        type: "quest",
        reference_id: id,
        description: `Quest completed: ${quest.title}`,
      });
    }

    return NextResponse.json({
      completed: true,
      rewards: {
        coins: quest.tc_reward ?? 0,
        xp: quest.xp_reward ?? 0,
        new_balance: newCoins,
        new_xp: newXp,
      },
    });
  }

  return NextResponse.json({ completed: true, rewards: null });
}
