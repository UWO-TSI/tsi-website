/**
 * Progression shared types (specs/progression-systems.md).
 * Mirrors web/supabase/migrations/029_progression.sql (unapplied draft).
 */

export const DELIVERY_KINDS = ["coins", "material", "specimen"] as const;
export type DeliveryKind = (typeof DELIVERY_KINDS)[number];

export const CONTRIBUTION_SOURCES = ["delivery", "event", "bounty", "admin"] as const;
export type ContributionSource = (typeof CONTRIBUTION_SOURCES)[number];

/** Weight key: a delivery is weighted by its kind, everything else by source. */
export type WeightKey = DeliveryKind | Exclude<ContributionSource, "delivery">;
export type GoalWeights = Record<WeightKey, number>;
export interface GoalCaps {
  /** Max points one member can add to one goal cycle, all sources except admin. */
  member_total: number;
  /** Max points one member can add through in-game deliveries. */
  delivery: number;
}

export type GoalType = "story" | "seasonal";

export interface ClubGoal {
  id: string;
  slug: string;
  title: string;
  summary: string;
  goal_type: GoalType;
  target_points: number;
  weights: GoalWeights;
  caps: GoalCaps;
  accepts: DeliveryKind[];
  window_start: string | null;
  window_end: string | null;
  unlocks: string[];
  monument_key: string;
  completion_letter_subject: string;
  completion_letter_body: string;
  position: number;
  active: boolean;
  created_at?: string;
}

export type ChapterRequirement = "settle_in" | "club_goal" | "oracle_trial";

export interface StepCopy {
  label: string;
  hint?: string;
}

export interface QuestChapter {
  id: string;
  slug: string;
  position: number;
  title: string;
  summary: string;
  requirement: ChapterRequirement;
  goal_slug: string | null;
  step_copy: Record<string, StepCopy>;
  unlocks_regions: string[];
  completion_letter: string;
  skippable_max_tier: number;
  /** Play coins paid once when the chapter is completed (not skipped). 033_economy.sql. */
  reward_coins: number;
  active: boolean;
}

export type StoredChapterStatus = "active" | "completed" | "skipped";

export interface MemberChapterProgress {
  chapter_id: string;
  status: StoredChapterStatus;
  steps_done: Record<string, string>;
  donated_item_key: string | null;
  completed_at: string | null;
}

/**
 * Where an objective points. The island agent maps each anchor to world
 * coordinates (MiniMap marker); this layer never knows world positions.
 */
export type ObjectiveAnchor = "hq" | "monument" | "fishing_spot" | "museum" | "oracle" | "ruins_gate";

export interface GoalProgressView {
  slug: string;
  title: string;
  summary: string;
  goal_type: GoalType;
  cycle: number;
  open: boolean;
  /** Story goals run in order: the earlier goal this one waits on, if any. */
  locked_by: string | null;
  target_points: number;
  points: number;
  percent: number;
  /** 0..4: plaza monument build stage (0/25/50/75/100%). */
  stage: number;
  completed: boolean;
  completed_at: string | null;
  contributors: number;
  accepts: DeliveryKind[];
  weights: GoalWeights;
  caps: GoalCaps;
  unlocks: string[];
  monument_key: string;
  /** Caller's own credited points this cycle (private). */
  my_points: number;
  my_delivery_points: number;
}

export type ChapterViewStatus = "locked" | "active" | "ready" | "completed" | "skipped";

export interface ChapterStepView {
  key: string;
  label: string;
  hint?: string;
  done: boolean;
  anchor: ObjectiveAnchor;
}

export interface ChapterView {
  slug: string;
  position: number;
  title: string;
  summary: string;
  requirement: ChapterRequirement;
  goal_slug: string | null;
  status: ChapterViewStatus;
  steps: ChapterStepView[];
  unlocks_regions: string[];
  can_skip: boolean;
  completed_at: string | null;
}

export interface Objective {
  chapter_slug: string;
  step_key: string;
  text: string;
  anchor: ObjectiveAnchor;
}

export interface LetterView {
  id: string;
  kind: "system" | "note";
  sender_id: string | null;
  sender_name: string;
  recipient_id: string;
  recipient_name: string;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
  reported: boolean;
  outgoing: boolean;
}

export interface ProgressionState {
  chapters: ChapterView[];
  goals: GoalProgressView[];
  objective: Objective | null;
  hud_muted: boolean;
  unlocked_regions: string[];
  unread_letters: number;
  /** "live" = database; "defaults" = migration not applied / offline preview. */
  source: "live" | "defaults";
}
