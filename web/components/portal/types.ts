/**
 * Portal UI helpers: the tier labels and XP progress. Types come from @/lib/supabase/types.
 */
import { xpForLevel } from "@/lib/supabase/types";

export { TIER_LABELS } from "@/lib/supabase/types";

export function getXpProgress(xp: number, level: number) {
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = nextLevelXp > currentLevelXp
    ? ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100
    : 0;
  return {
    level,
    current: xp - currentLevelXp,
    needed: nextLevelXp - currentLevelXp,
    percent: Math.max(0, Math.min(100, progress)),
  };
}
