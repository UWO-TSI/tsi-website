"use client";

/**
 * Maps ProgressionState into what the island renders (WorldProgression)
 * without importing world code: anchors → XZ come from the caller
 * (lib/game/progressionBridge.ts passes resolveAnchor).
 */
import { useProgression } from "./useProgression";
import { activeGoal } from "./devOverride";
import { MONUMENT_STAGES } from "./goals";
import type { GoalProgressView, ObjectiveAnchor, ProgressionState } from "./types";

export type WorldGoalId = "cafe" | "museum";
export type AnchorResolver = (anchor: ObjectiveAnchor) => [number, number] | null;

export interface WorldProgression {
  /** `stage`: the plaza monument's build stage 0..4, as the server computed it. */
  activeGoal: { id: WorldGoalId; label: string; progress: number; stage: number; completed: boolean } | null;
  completedGoals: WorldGoalId[];
  /**
   * Latest goal completed in the last 14 days, for the ceremony: pass it to
   * useCeremony() (which dedupes by localStorage "seen"). Needed because
   * activeGoal moves on to the next story goal as soon as one completes.
   */
  recentlyCompleted: { id: WorldGoalId; label: string; progress: 1; stage: typeof MONUMENT_STAGES; completed: true } | null;
  objective: { text: string; target: [number, number] | null; anchor: ObjectiveAnchor | null };
  unreadLetters: number;
  /** Regions this member has opened (village_core, cafe, museum, woods, cliffs, ruins_gate...). */
  unlockedRegions: string[];
  hudMuted: boolean;
  source: "live" | "defaults";
}

const SLUG_TO_WORLD: Record<string, WorldGoalId> = { "reopen-cafe": "cafe", "fund-museum": "museum" };

export function worldGoalId(goal: Pick<GoalProgressView, "slug" | "unlocks">): WorldGoalId | null {
  if (SLUG_TO_WORLD[goal.slug]) return SLUG_TO_WORLD[goal.slug];
  if (goal.unlocks.includes("cafe")) return "cafe";
  if (goal.unlocks.includes("museum")) return "museum";
  return null;
}

const CEREMONY_WINDOW_MS = 14 * 86_400_000;

export function toWorldProgression(state: ProgressionState, resolve: AnchorResolver, now = Date.now()): WorldProgression {
  // The monument shows the goal being built, or the one that just finished
  // (so the ceremony can play) when nothing else is open.
  const building = activeGoal(state.goals) ?? [...state.goals].reverse().find((g) => g.completed) ?? null;
  const buildingId = building ? worldGoalId(building) : null;
  const objective = state.objective;
  const recent = state.goals
    .filter((g) => g.completed && g.completed_at && now - Date.parse(g.completed_at) < CEREMONY_WINDOW_MS && worldGoalId(g))
    .sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!))[0];
  return {
    activeGoal: building && buildingId ? { id: buildingId, label: building.title, progress: building.percent / 100, stage: building.stage, completed: building.completed } : null,
    recentlyCompleted: recent ? { id: worldGoalId(recent)!, label: recent.title, progress: 1, stage: MONUMENT_STAGES, completed: true } : null,
    completedGoals: state.goals.filter((g) => g.completed).map(worldGoalId).filter((id): id is WorldGoalId => id !== null),
    objective: objective
      ? { text: objective.text, target: resolve(objective.anchor), anchor: objective.anchor }
      : { text: "", target: null, anchor: null },
    unreadLetters: state.unread_letters,
    unlockedRegions: state.unlocked_regions,
    hudMuted: state.hud_muted,
    source: state.source,
  };
}

export function useProgressionWorldSource(resolve: AnchorResolver): WorldProgression {
  const { state } = useProgression();
  return toWorldProgression(state, resolve);
}
