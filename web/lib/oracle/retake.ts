/**
 * Retake / respec rules (rows 20, 207): the first reading is free; after a
 * result exists, a new reading is a respec that costs play coins at the
 * Oracle and waits out a cooldown. An unfinished attempt is resumed, never
 * restarted (so nobody can reroll answers for free).
 */
export const RESPEC_FEE_COINS = 250;
export const RESPEC_COOLDOWN_DAYS = 7;
const DAY = 86_400_000;

export type StartDecision =
  | { kind: "resume"; attemptId: string }
  | { kind: "free" }
  | { kind: "respec"; fee: number }
  | { kind: "cooldown"; until: string };

export function startDecision(input: { openAttemptId: string | null; lastResultAt: string | null; now: Date; fee?: number; cooldownDays?: number }): StartDecision {
  if (input.openAttemptId) return { kind: "resume", attemptId: input.openAttemptId };
  if (!input.lastResultAt) return { kind: "free" };
  const until = Date.parse(input.lastResultAt) + (input.cooldownDays ?? RESPEC_COOLDOWN_DAYS) * DAY;
  if (input.now.getTime() < until) return { kind: "cooldown", until: new Date(until).toISOString() };
  return { kind: "respec", fee: input.fee ?? RESPEC_FEE_COINS };
}
