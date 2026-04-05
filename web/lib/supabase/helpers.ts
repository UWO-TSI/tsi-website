import { createClient } from "./server";
import { levelFromXp, rankFromLevel } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Awards XP and coins to a user, auto-computing level and rank.
 * Records transactions in tc_transactions and xp_transactions.
 *
 * Returns the updated profile snapshot or null if profile not found.
 */
export async function awardRewards(
  supabase: SupabaseClient,
  userId: string,
  rewards: {
    coins?: number;
    xp?: number;
    coinType?: string;
    xpType?: string;
    referenceId?: string;
    description?: string;
  }
): Promise<{
  tethos_coins: number;
  xp: number;
  level: number;
  rank: string;
} | null> {
  const { coins = 0, xp = 0, coinType, xpType, referenceId, description } = rewards;

  if (coins === 0 && xp === 0) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tethos_coins, xp, level, rank")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  const newCoins = profile.tethos_coins + coins;
  const newXp = profile.xp + xp;
  const newLevel = levelFromXp(newXp);
  const newRank = rankFromLevel(newLevel);

  await supabase
    .from("profiles")
    .update({
      tethos_coins: newCoins,
      xp: newXp,
      level: newLevel,
      rank: newRank,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  // Record coin transaction
  if (coins > 0 && coinType) {
    await supabase.from("tc_transactions").insert({
      user_id: userId,
      amount: coins,
      balance_after: newCoins,
      type: coinType,
      reference_id: referenceId ?? null,
      description: description ?? null,
    });
  }

  // Record XP transaction
  if (xp > 0 && xpType) {
    await supabase.from("xp_transactions").insert({
      user_id: userId,
      amount: xp,
      type: xpType,
      reference_id: referenceId ?? null,
      description: description ?? null,
    });
  }

  return { tethos_coins: newCoins, xp: newXp, level: newLevel, rank: newRank };
}
