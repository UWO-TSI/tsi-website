"use client";

/**
 * Browser transport for /api/progression/*. When the API can't answer
 * (signed out, migration 029 not applied, offline) the journal falls back
 * to the seeded chapters/goals with zero progress, marked source "defaults".
 */
import { evaluateChapters, currentObjective, unlockedRegions, type AdvanceAction } from "./chapters";
import { DEFAULT_CHAPTERS, DEFAULT_GOALS } from "./defaults";
import { goalCycle } from "./goals";
import type { DeliveryKind, GoalProgressView, LetterView, ProgressionState } from "./types";
import { ApiError, apiCall } from "@/lib/apiClient";

export function previewState(now = new Date()): ProgressionState {
  const goals: GoalProgressView[] = DEFAULT_GOALS.map((g, i) => {
    const c = goalCycle(g, now), first = i === 0 || g.goal_type === "seasonal";
    return {
      slug: g.slug, title: g.title, summary: g.summary, goal_type: g.goal_type, cycle: c.cycle, open: c.open && first,
      locked_by: first ? null : DEFAULT_GOALS[i - 1].slug,
      target_points: g.target_points, points: 0, percent: 0, stage: 0, completed: false, completed_at: null, contributors: 0,
      accepts: g.accepts, weights: g.weights, caps: g.caps, unlocks: g.unlocks, monument_key: g.monument_key,
      window_start: g.window_start, window_end: g.window_end, event: g.event, my_points: 0, my_delivery_points: 0,
    };
  });
  const chapters = evaluateChapters(DEFAULT_CHAPTERS, [], {
    tier: 5, oracleDone: false, trialDone: false, firstCatchKey: null,
    goals: Object.fromEntries(goals.map((g) => [g.slug, { completed: false, myPoints: 0 }])),
  });
  return { chapters, goals, objective: currentObjective(chapters, false), hud_muted: false, unlocked_regions: unlockedRegions(chapters, new Set()), unread_letters: 0, source: "defaults" };
}

export async function fetchState(): Promise<ProgressionState> {
  try {
    return await apiCall<ProgressionState>("/api/progression/state", "state");
  } catch {
    return previewState();
  }
}

export const advance = (chapter_slug: string, action: AdvanceAction) =>
  apiCall<ProgressionState>("/api/progression/chapters/advance", "state", { chapter_slug, action });

export const setHudMuted = (hud_muted: boolean) => apiCall<boolean>("/api/progression/prefs", "hud_muted", { hud_muted });

export interface ContributionReceipt {
  replayed: boolean;
  credited_points: number;
  /** Units actually consumed (0 on a replay); mirror this into local wallets. */
  amount_used: number;
  capped: boolean;
  completed_now: boolean;
  goal: GoalProgressView;
}

/**
 * Deliver to a goal. Pass the same key when retrying the same delivery;
 * the server credits and charges it once.
 */
export async function deliver(input: { goal_slug: string; kind: DeliveryKind; amount: number; item_key?: string | null }, key: string, retries = 2): Promise<ContributionReceipt> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await apiCall<ContributionReceipt>("/api/progression/contribute", "contribution", { ...input, idempotency_key: key });
    } catch (err) {
      lastError = err;
      // Only network failures and 5xx are worth a same-key retry.
      if (err instanceof ApiError && err.status < 500) throw err;
    }
  }
  throw lastError;
}

export const listLetters = () => apiCall<LetterView[]>("/api/progression/letters", "letters");
export const sendLetter = (to: string, subject: string, body: string) => apiCall<{ id: string }>("/api/progression/letters", "letter", { to, subject, body });
export const markRead = (id: string) => apiCall<unknown>(`/api/progression/letters/${id}`, "ok", { action: "read" }, "PATCH");
export const reportLetter = (id: string, reason: string) => apiCall<unknown>(`/api/progression/letters/${id}`, "ok", { action: "report", reason }, "PATCH");
