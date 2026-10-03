/**
 * Portal UI constants: tier labels and helpers.
 * All TYPE imports come from @/lib/supabase/types (Backend's canonical source).
 * This file only contains UI-specific mappings that don't belong in the DB types.
 */

// Re-export Backend types so existing imports still work
export type {
  Tier,
  Profile,
  DirectoryMember,
  PublicProfile,
  ClassName,
  RankTitle,
  Position,
  AvatarConfig,
  SocialLinks,
} from "@/lib/supabase/types";

export {
  TIER_LABELS,
  xpForLevel,
  levelFromXp,
  rankFromLevel,
  canAccessFeature,
} from "@/lib/supabase/types";

// ─── XP Progress Helper ─────────────────────────────────────────
import { xpForLevel } from "@/lib/supabase/types";

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
