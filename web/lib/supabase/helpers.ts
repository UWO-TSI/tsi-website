import { createClient } from "./server";
import { levelFromXp, rankFromLevel } from "./types";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Awards XP and Gems to a user (service-role client), auto-computing level
 * and rank. Gems go through wallet_apply (locked, recorded in tc_transactions,
 * idempotent per `key`, so a retried award pays once); XP is recorded in
 * xp_transactions.
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
    /** Idempotency key for the Gem credit, unique per user (e.g. `bounty:<id>`). */
    key: string;
  }
): Promise<{
  tethos_coins: number;
  xp: number;
  level: number;
  rank: string;
} | null> {
  const { coins = 0, xp = 0, coinType, xpType, referenceId, description, key } = rewards;

  if (coins === 0 && xp === 0) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tethos_coins, xp, level, rank")
    .eq("id", userId)
    .single();

  if (!profile) return null;

  const tethos_coins = coins > 0
    ? (await supabaseEconomyStore(supabase).credit(userId, "gems", coins, coinType ?? "earn_admin", description ?? "", key)).balance
    : profile.tethos_coins;
  const newXp = profile.xp + xp;
  const newLevel = levelFromXp(newXp);
  const newRank = rankFromLevel(newLevel);

  if (xp > 0) {
    await supabase
      .from("profiles")
      .update({ xp: newXp, level: newLevel, rank: newRank, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (xpType) {
      await supabase.from("xp_transactions").insert({
        user_id: userId,
        amount: xp,
        type: xpType,
        reference_id: referenceId ?? null,
        description: description ?? null,
      });
    }
  }

  return { tethos_coins, xp: newXp, level: newLevel, rank: newRank };
}
