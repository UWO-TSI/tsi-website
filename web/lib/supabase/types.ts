export type Tier = 1 | 2 | 3 | 4;

export type Position =
  | "president"
  | "senior_advisor"
  | "pmo"
  | "pm"
  | "vp"
  | "developer"
  | "director"
  | "general"
  | "volunteer";

export type ClassName =
  | "ARCHITECT"
  | "ORACLE"
  | "STRATEGIST"
  | "COMMANDER"
  | "WARDEN"
  | "ENGINEER"
  | "OPERATIVE"
  | "INITIATE"
  | "SCOUT";

export type RankTitle =
  | "Initiate"
  | "Adept"
  | "Veteran"
  | "Elite"
  | "Legend"
  | "Mythic";

export type Side = "operations" | "projects" | null;

export type Portfolio = "external" | "internal" | "marketing" | null;

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  tier: Tier;
  position: Position | null;
  class: ClassName | null;
  subclass: string | null;
  team_id: string | null;
  portfolio: Portfolio;
  side: Side;

  // Gamification
  xp: number;
  level: number;
  rank: RankTitle;
  tethos_coins: number;

  // Onboarding
  onboarding_completed: boolean;
  onboarding_step: number;

  // Profile fields
  year: string | null;
  program: string | null;
  hometown: string | null;
  birthday: string | null;
  phone: string | null;
  preferred_email: string | null;
  uwo_email: string | null;
  gdrive_email: string | null;
  github_username: string | null;
  instagram: string | null;
  linkedin: string | null;
  discord_tag: string | null;
  favourite_music: string | null;
  dream_retirement: string | null;
  spirit_animal: string | null;
  fun_fact: string | null;
  avatar_url: string | null;
  bio: string | null;

  // Theme
  active_theme: string;

  // Meta
  is_alumni: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  login_streak: number;
}

// Position to class mapping
export const POSITION_CLASS_MAP: Record<Position, ClassName> = {
  president: "ARCHITECT",
  senior_advisor: "ORACLE",
  pmo: "STRATEGIST",
  pm: "COMMANDER",
  vp: "WARDEN",
  developer: "ENGINEER",
  director: "OPERATIVE",
  general: "INITIATE",
  volunteer: "SCOUT",
};

// Position to tier mapping
export const POSITION_TIER_MAP: Record<Position, Tier> = {
  president: 1,
  senior_advisor: 2,
  pmo: 2,
  pm: 2,
  vp: 2,
  developer: 3,
  director: 3,
  general: 4,
  volunteer: 4,
};

// Level calculation
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.8));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) {
    level++;
  }
  return level;
}

export function rankFromLevel(level: number): RankTitle {
  if (level >= 25) return "Mythic";
  if (level >= 20) return "Legend";
  if (level >= 15) return "Elite";
  if (level >= 10) return "Veteran";
  if (level >= 5) return "Adept";
  return "Initiate";
}

// Permission helpers
export function canAccessFeature(
  tier: Tier,
  feature: string
): boolean {
  const permissions: Record<string, Tier[]> = {
    dashboard: [1, 2, 3, 4],
    bounty_board: [1, 2, 3],
    calendar: [1, 2, 3, 4],
    kanban: [1, 2, 3],
    marketplace: [1, 2, 3],
    job_board: [1, 2, 3, 4],
    directory: [1, 2, 3, 4],
    tools: [1, 2, 3],
    quests: [1, 2, 3],
    leaderboard: [1, 2, 3, 4],
    portfolio: [1, 2, 3],
    mentorship: [1, 2, 3],
    admin: [1, 2],
    announcements_create: [1, 2],
    member_management: [1, 2],
    analytics: [1, 2],
  };

  return permissions[feature]?.includes(tier) ?? false;
}
