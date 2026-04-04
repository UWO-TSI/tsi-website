/**
 * Portal UI types and helpers.
 * Core types re-exported from Backend's canonical types.ts.
 * UI-specific constants (tier colors, XP helpers) live here.
 */

// Re-export Backend types that portal components use
export type {
  Tier,
  Profile,
  DirectoryMember,
  PublicProfile,
  ClassName,
  Position,
  RankTitle,
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

import type { Tier } from "@/lib/supabase/types";
import { xpForLevel } from "@/lib/supabase/types";

// Matches specs/ux-directory.md Section 5 and specs/tokens.md Section 8
export const TIER_COLORS: Record<Tier, { color: string; bg: string; border: string }> = {
  1: { color: "#ffd166", bg: "rgba(255, 209, 102, 0.2)", border: "#ffd166" },
  2: { color: "#4A7AFF", bg: "rgba(0, 47, 167, 0.2)", border: "#002fa7" },
  3: { color: "#22d3ee", bg: "rgba(34, 211, 238, 0.2)", border: "#22d3ee" },
  4: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.2)", border: "#22c55e" },
  5: { color: "#a1a1aa", bg: "rgba(161, 161, 170, 0.15)", border: "#52525b" },
};

export function getXpProgress(xp: number, level: number) {
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progressInLevel = xp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  return {
    level,
    current: Math.max(0, progressInLevel),
    needed: xpNeeded,
    percent: xpNeeded > 0 ? Math.min(100, (progressInLevel / xpNeeded) * 100) : 0,
  };
}
