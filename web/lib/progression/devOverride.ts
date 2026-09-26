/**
 * `?goal=` dev override for screenshots (never in production builds).
 *   ?goal=0.6               active goal at 60%
 *   ?goal=fund-museum:0.6   that goal at 60%
 *   ?goal=reopen-cafe:1     that goal complete
 * Same 0..1 convention as the island's progressionBridge `?goal=`.
 */
import { goalPercent, monumentStage } from "./goals";
import type { GoalProgressView, ProgressionState } from "./types";

export interface GoalOverride {
  slug: string | null;
  fraction: number;
}

export function parseGoalOverride(search: string, isProduction = process.env.NODE_ENV === "production"): GoalOverride | null {
  if (isProduction) return null;
  const raw = new URLSearchParams(search).get("goal");
  if (!raw) return null;
  const [a, b] = raw.includes(":") ? raw.split(":", 2) : [null, raw];
  const fraction = Number(b);
  if (!Number.isFinite(fraction)) return null;
  const slug = a && /^[a-z0-9-]{1,64}$/.test(a) ? a : null;
  return { slug, fraction: Math.min(1, Math.max(0, fraction)) };
}

/** The goal the plaza monument builds toward: first open, incomplete goal. */
export function activeGoal(goals: GoalProgressView[]): GoalProgressView | null {
  return goals.find((g) => !g.completed && g.open) ?? null;
}

export function applyGoalOverride(state: ProgressionState, o: GoalOverride | null): ProgressionState {
  if (!o) return state;
  const target = o.slug ? state.goals.find((g) => g.slug === o.slug) : activeGoal(state.goals);
  if (!target) return state;
  const goals = state.goals.map((g) => {
    if (g !== target) return g;
    const points = Math.round(g.target_points * o.fraction);
    const completed = o.fraction >= 1;
    const percent = completed ? 100 : goalPercent(points, g.target_points);
    return { ...g, points, percent, stage: monumentStage(percent), completed, completed_at: completed ? (g.completed_at ?? new Date().toISOString()) : null, open: !completed, locked_by: null };
  });
  return { ...state, goals };
}
