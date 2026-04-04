import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardRewards } from "@/lib/supabase/helpers";
import { z } from "zod";

const AwardSchema = z.object({
  user_id: z.string().uuid(),
});

// POST /api/achievements/[id]/award — award an achievement to a user (T1-T3 only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only T1-T3 can award achievements
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.tier > 3) {
    return NextResponse.json({ error: "Forbidden — T1-T3 only" }, { status: 403 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AwardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify achievement exists
  const { data: achievement } = await supabase
    .from("achievements")
    .select("id, name, display_name, tc_reward, xp_reward")
    .eq("id", id)
    .single();

  if (!achievement) {
    return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
  }

  // Verify target user exists
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", parsed.data.user_id)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if already awarded
  const { data: existing } = await supabase
    .from("user_achievements")
    .select("id")
    .eq("user_id", parsed.data.user_id)
    .eq("achievement_id", id)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "User already has this achievement" },
      { status: 409 }
    );
  }

  // Award the achievement
  const { error: insertError } = await supabase
    .from("user_achievements")
    .insert({
      user_id: parsed.data.user_id,
      achievement_id: id,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Award associated rewards (coins + XP with auto level-up)
  const rewards = await awardRewards(supabase, parsed.data.user_id, {
    coins: achievement.tc_reward ?? 0,
    xp: achievement.xp_reward ?? 0,
    coinType: "earn_achievement",
    xpType: "achievement",
    referenceId: id,
    description: `Achievement unlocked: ${achievement.display_name}`,
  });

  return NextResponse.json({
    success: true,
    achievement: achievement.display_name,
    user: parsed.data.user_id,
    rewards: rewards
      ? {
          coins: achievement.tc_reward ?? 0,
          xp: achievement.xp_reward ?? 0,
          new_balance: rewards.tethos_coins,
          new_xp: rewards.xp,
          new_level: rewards.level,
          new_rank: rewards.rank,
        }
      : null,
  });
}
