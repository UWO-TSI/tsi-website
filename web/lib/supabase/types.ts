// ─── Tier System ────────────────────────────────────────────────────────────
// T1=David (super admin), T2=presidents, T3=PM/VP, T4=dev/director, T5=volunteer

export type Tier = 1 | 2 | 3 | 4 | 5;

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

// ─── Profile ────────────────────────────────────────────────────────────────

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
  has_voted: boolean;

  // Game world
  avatar_config: AvatarConfig;
  skills: string[];
  social_links: SocialLinks;

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

// ─── Avatar & Game Types ────────────────────────────────────────────────────

export interface AvatarConfig {
  body?: string;
  hair?: string;
  face?: string;
  outfit?: string;
  accessory?: string;
  hair_color?: string;
  skin_color?: string;
  outfit_color?: string;
}

export interface SocialLinks {
  github?: string;
  linkedin?: string;
  instagram?: string;
  discord?: string;
  twitter?: string;
  website?: string;
}

export type ItemType = "hair" | "face" | "outfit" | "accessory" | "effect" | "emote";
export type ItemCategory = "default" | "shop" | "achievement" | "event" | "admin";
export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface AvatarItem {
  id: string;
  name: string;
  type: ItemType;
  category: ItemCategory;
  coin_price: number;
  sprite_url: string | null;
  rarity: ItemRarity;
  is_available: boolean;
  created_at: string;
}

export interface PlayerInventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  equipped: boolean;
  acquired_at: string;
}

// ─── Bounty Types ───────────────────────────────────────────────────────────

export type BountyStatus = "pending" | "open" | "claimed" | "in_progress" | "review" | "completed" | "expired";
export type SubmissionStatus = "pending" | "approved" | "rejected" | "revision_requested";

export interface Bounty {
  id: string;
  title: string;
  description: string;
  client_name: string | null;
  pay_cad: number | null;
  pay_tc: number | null;
  xp_reward: number;
  difficulty: number;
  deadline: string | null;
  tech_stack: string[];
  status: BountyStatus;
  submitted_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BountySubmission {
  id: string;
  bounty_id: string;
  user_id: string;
  submission_text: string;
  attachment_urls: string[];
  status: SubmissionStatus;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Job Listing Types ──────────────────────────────────────────────────────

export type JobType = "internship" | "full_time" | "part_time" | "contract";

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string | null;
  job_type: JobType;
  url: string;
  categories: string[];
  tags: string[];
  description: string | null;
  posted_by: string | null;
  is_flagged: boolean;
  created_at: string;
}

// ─── Leaderboard Types ─────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank_position: number;
  id: string;
  display_name: string;
  avatar_url: string | null;
  tier: Tier;
  position: Position | null;
  class: ClassName | null;
  subclass: string | null;
  level: number;
  xp: number;
  rank: RankTitle;
  is_active: boolean;
}

// ─── Oracle Types ───────────────────────────────────────────────────────────

export interface OracleQuestion {
  id: number;
  dimension: string;
  text: string;
  options: { label: string; pole: string }[];
}

export interface OracleResult {
  mbti_type: string;
  class: ClassName;
  subclass: string;
}

// ─── Achievement Types ──────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  display_name: string;
  description: string;
  icon: string | null;
  tc_reward: number;
  xp_reward: number;
  is_secret: boolean;
  criteria_type: string | null;
  criteria_value: number | null;
  created_at: string;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface AchievementWithStatus extends Achievement {
  unlocked: boolean;
  unlocked_at: string | null;
}

// ─── Directory (public-facing subset of Profile) ────────────────────────────

export interface DirectoryMember {
  id: string;
  display_name: string;
  avatar_url: string | null;
  tier: Tier;
  position: Position | null;
  class: ClassName | null;
  level: number;
  xp: number;
  skills: string[];
  is_active: boolean;
}

export interface PublicProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  tier: Tier;
  position: Position | null;
  class: ClassName | null;
  subclass: string | null;
  level: number;
  xp: number;
  rank: RankTitle;
  skills: string[];
  bio: string | null;
  social_links: SocialLinks;
  is_active: boolean;
  created_at: string;
}

// ─── Mappings ───────────────────────────────────────────────────────────────

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

export const POSITION_TIER_MAP: Record<Position, Tier> = {
  president: 1,
  senior_advisor: 2,
  pmo: 2,
  pm: 2,
  vp: 2,
  developer: 3,
  director: 3,
  general: 4,
  volunteer: 5,
};

export const TIER_LABELS: Record<Tier, string> = {
  1: "Founder",
  2: "President",
  3: "Lead",
  4: "Member",
  5: "Volunteer",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

export function canAccessFeature(
  tier: Tier,
  feature: string
): boolean {
  const permissions: Record<string, Tier[]> = {
    dashboard: [1, 2, 3, 4, 5],
    bounty_board: [1, 2, 3],
    calendar: [1, 2, 3, 4, 5],
    kanban: [1, 2, 3],
    marketplace: [1, 2, 3, 4, 5],
    job_board: [1, 2, 3, 4, 5],
    directory: [1, 2, 3, 4, 5],
    tools: [1, 2, 3],
    quests: [1, 2, 3, 4, 5],
    leaderboard: [1, 2, 3, 4, 5],
    portfolio: [1, 2, 3],
    mentorship: [1, 2, 3],
    admin: [1, 2],
    announcements_create: [1, 2],
    member_management: [1, 2],
    analytics: [1, 2],
    election_admin: [1, 2],
  };

  return permissions[feature]?.includes(tier) ?? false;
}
