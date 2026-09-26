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

export class ProgressionRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit | undefined, key: string): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body || body.ok !== true) {
    const message = body && typeof body.error === "string" ? body.error : "Request failed";
    throw new ProgressionRequestError(message, res.status, body && typeof body.code === "string" ? body.code : undefined);
  }
  return body[key] as T;
}

export function previewState(now = new Date()): ProgressionState {
  const goals: GoalProgressView[] = DEFAULT_GOALS.map((g, i) => ({
    slug: g.slug, title: g.title, summary: g.summary, goal_type: g.goal_type, cycle: 0, open: goalCycle(g, now).open && i === 0,
    locked_by: i === 0 ? null : DEFAULT_GOALS[i - 1].slug,
    target_points: g.target_points, points: 0, percent: 0, stage: 0, completed: false, completed_at: null, contributors: 0,
    accepts: g.accepts, weights: g.weights, caps: g.caps, unlocks: g.unlocks, monument_key: g.monument_key, my_points: 0, my_delivery_points: 0,
  }));
  const chapters = evaluateChapters(DEFAULT_CHAPTERS, [], {
    tier: 5, oracleDone: false, trialDone: false, firstCatchKey: null,
    goals: Object.fromEntries(goals.map((g) => [g.slug, { completed: false, myPoints: 0 }])),
  });
  return { chapters, goals, objective: currentObjective(chapters, false), hud_muted: false, unlocked_regions: unlockedRegions(chapters, new Set()), unread_letters: 0, source: "defaults" };
}

export async function fetchState(): Promise<ProgressionState> {
  try {
    return await call<ProgressionState>("/api/progression/state", undefined, "state");
  } catch {
    return previewState();
  }
}

export const advance = (chapter_slug: string, action: AdvanceAction) =>
  call<ProgressionState>("/api/progression/chapters/advance", { method: "POST", body: JSON.stringify({ chapter_slug, action }) }, "state");

export const setHudMuted = (hud_muted: boolean) =>
  call<boolean>("/api/progression/prefs", { method: "POST", body: JSON.stringify({ hud_muted }) }, "hud_muted");

export interface ContributionReceipt {
  replayed: boolean;
  credited_points: number;
  /** Units actually consumed (0 on a replay); mirror this into local wallets. */
  amount_used: number;
  capped: boolean;
  completed_now: boolean;
  goal: GoalProgressView;
}

export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  return c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Deliver to a goal. Pass the same key when retrying the same delivery;
 * the server credits and charges it once.
 */
export async function deliver(input: { goal_slug: string; kind: DeliveryKind; amount: number; item_key?: string | null }, key: string, retries = 2): Promise<ContributionReceipt> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await call<ContributionReceipt>("/api/progression/contribute", { method: "POST", body: JSON.stringify({ ...input, idempotency_key: key }) }, "contribution");
    } catch (err) {
      lastError = err;
      // Only network failures and 5xx are worth a same-key retry.
      if (err instanceof ProgressionRequestError && err.status < 500) throw err;
    }
  }
  throw lastError;
}

export const listLetters = () => call<LetterView[]>("/api/progression/letters", undefined, "letters");
export const sendLetter = (to: string, subject: string, body: string) =>
  call<{ id: string }>("/api/progression/letters", { method: "POST", body: JSON.stringify({ to, subject, body }) }, "letter");
export const markRead = (id: string) => call<unknown>(`/api/progression/letters/${id}`, { method: "PATCH", body: JSON.stringify({ action: "read" }) }, "ok");
export const reportLetter = (id: string, reason: string) =>
  call<unknown>(`/api/progression/letters/${id}`, { method: "PATCH", body: JSON.stringify({ action: "report", reason }) }, "ok");
