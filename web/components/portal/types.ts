/**
 * Portal UI constants — tier colors, labels, and helpers.
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
  SocialLinks,
} from "@/lib/supabase/types";

export {
  TIER_LABELS,
  xpForLevel,
  levelFromXp,
  rankFromLevel,
  canAccessFeature,
} from "@/lib/supabase/types";

import type { Tier } from "@/lib/supabase/types";

// ─── Tier Colors (from specs/ux-directory.md Section 5) ─────────
export const TIER_COLORS: Record<Tier, { color: string; bg: string; border: string }> = {
  1: { color: "#ffd166", bg: "rgba(255, 209, 102, 0.2)", border: "#ffd166" },
  2: { color: "#4A7AFF", bg: "rgba(0, 47, 167, 0.2)", border: "#002fa7" },
  3: { color: "#22d3ee", bg: "rgba(34, 211, 238, 0.2)", border: "#22d3ee" },
  4: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.2)", border: "#22c55e" },
  5: { color: "#a1a1aa", bg: "rgba(161, 161, 170, 0.15)", border: "#52525b" },
};

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
