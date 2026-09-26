/**
 * Club goal math: cycles (story vs yearly seasonal), weights, per-member
 * caps and monument stages. Pure; the route and the SQL function both
 * enforce the result (029_progression.sql re-checks caps under a row lock).
 */
import { DEFAULT_CAPS, DEFAULT_WEIGHTS } from "./defaults";
import {
  DELIVERY_KINDS,
  type ClubGoal,
  type ContributionSource,
  type DeliveryKind,
  type GoalCaps,
  type GoalWeights,
  type WeightKey,
} from "./types";

export const MONUMENT_STAGES = 4;
export const MAX_DELIVERY_UNITS = 5000;

export interface GoalCycle {
  cycle: number;
  start: Date | null;
  end: Date | null;
  open: boolean;
}

const DAY = 86_400_000;

function shiftToYear(date: Date, year: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(year);
  return d;
}

/**
 * Story goals run in cycle 0 for their whole life. Seasonal goals repeat
 * yearly: the authored window is moved to the current year and the cycle is
 * the year the window opened (so a Dec–Jan window stays one cycle).
 */
export function goalCycle(goal: Pick<ClubGoal, "goal_type" | "window_start" | "window_end" | "active">, now: Date): GoalCycle {
  const start = goal.window_start ? new Date(goal.window_start) : null;
  const end = goal.window_end ? new Date(goal.window_end) : null;
  if (goal.goal_type === "story" || !start || !end) {
    const open = goal.active && (!start || now >= start) && (!end || now <= end);
    return { cycle: 0, start, end, open };
  }
  const span = Math.max(end.getTime() - start.getTime(), DAY);
  const year = now.getUTCFullYear();
  for (const y of [year, year - 1]) {
    const s = shiftToYear(start, y);
    const e = new Date(s.getTime() + span);
    if (now >= s) {
      return { cycle: y, start: s, end: e, open: goal.active && now <= e };
    }
  }
  const s = shiftToYear(start, year);
  return { cycle: year, start: s, end: new Date(s.getTime() + span), open: false };
}

export function weightKeyFor(source: ContributionSource, kind: DeliveryKind | null): WeightKey | null {
  if (source === "delivery") return kind ?? null;
  return source;
}

export interface MemberTotals {
  credited_points: number;
  delivery_points: number;
}

export type PlanRejection = "invalid_amount" | "kind_not_accepted" | "not_weighted" | "cap_reached";

export type ContributionPlan =
  | {
      ok: true;
      weight: number;
      creditedPoints: number;
      amountUsed: number;
      capped: boolean;
      /** Caps to re-check atomically; null = not applicable. */
      memberCap: number | null;
      deliveryCap: number | null;
    }
  | { ok: false; reason: PlanRejection };

/**
 * Turn an offer (source, kind, units) into credited points.
 * - weight comes from the goal (admin-set), never from the client;
 * - member_total caps every source except admin credits (admins log real
 *   activity deliberately and are trusted to size it);
 * - delivery caps in-game deliveries on top of member_total;
 * - a capped delivery only consumes the units that count (rounded up by at
 *   most one unit), so members are never charged for points they don't get.
 */
export function planContribution(input: {
  goal: Pick<ClubGoal, "weights" | "caps" | "accepts">;
  source: ContributionSource;
  kind: DeliveryKind | null;
  amount: number;
  totals: MemberTotals;
}): ContributionPlan {
  const { goal, source, kind, amount, totals } = input;
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_DELIVERY_UNITS) return { ok: false, reason: "invalid_amount" };
  if (source === "delivery" && (!kind || !goal.accepts.includes(kind))) return { ok: false, reason: "kind_not_accepted" };
  const key = weightKeyFor(source, kind);
  const weight = key ? goal.weights[key] : 0;
  if (!Number.isFinite(weight) || weight <= 0) return { ok: false, reason: "not_weighted" };

  const raw = Math.floor(amount * weight);
  const memberCap = source === "admin" ? null : goal.caps.member_total;
  const deliveryCap = source === "delivery" ? goal.caps.delivery : null;
  let room = Number.POSITIVE_INFINITY;
  if (memberCap !== null) room = Math.min(room, memberCap - totals.credited_points);
  if (deliveryCap !== null) room = Math.min(room, deliveryCap - totals.delivery_points);
  room = Math.max(0, room);

  const credited = Math.min(raw, room);
  if (credited <= 0) return { ok: false, reason: raw <= 0 ? "not_weighted" : "cap_reached" };
  const amountUsed = source === "delivery" ? Math.min(amount, Math.ceil(credited / weight)) : amount;
  return { ok: true, weight, creditedPoints: credited, amountUsed, capped: credited < raw, memberCap, deliveryCap };
}

export function goalPercent(points: number, target: number): number {
  if (!(target > 0)) return 0;
  return Math.max(0, Math.min(100, Math.floor((points / target) * 100)));
}

/** Plaza monument build stage: 0 (<25%), 1, 2, 3, 4 (complete). */
export function monumentStage(percent: number): number {
  if (!(percent > 0)) return 0;
  return Math.min(MONUMENT_STAGES, Math.floor(percent / 25));
}

// ─── Row normalisation (JSONB is untrusted shape) ────────────────────────────

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback);

export function normalizeWeights(value: unknown): GoalWeights {
  const w = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_WEIGHTS };
  for (const k of Object.keys(out) as WeightKey[]) out[k] = num(w[k], DEFAULT_WEIGHTS[k]);
  return out;
}

export function normalizeCaps(value: unknown): GoalCaps {
  const c = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    member_total: Math.floor(num(c.member_total, DEFAULT_CAPS.member_total)),
    delivery: Math.floor(num(c.delivery, DEFAULT_CAPS.delivery)),
  };
}

export function normalizeGoal(row: Record<string, unknown>): ClubGoal {
  const accepts = Array.isArray(row.accepts)
    ? (row.accepts.filter((k) => (DELIVERY_KINDS as readonly string[]).includes(String(k))) as DeliveryKind[])
    : [];
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    goal_type: row.goal_type === "seasonal" ? "seasonal" : "story",
    target_points: Math.max(1, Math.floor(num(row.target_points, 1))),
    weights: normalizeWeights(row.weights),
    caps: normalizeCaps(row.caps),
    accepts,
    window_start: typeof row.window_start === "string" ? row.window_start : null,
    window_end: typeof row.window_end === "string" ? row.window_end : null,
    unlocks: Array.isArray(row.unlocks) ? row.unlocks.map(String) : [],
    monument_key: typeof row.monument_key === "string" ? row.monument_key : "plaza",
    completion_letter_subject: String(row.completion_letter_subject ?? ""),
    completion_letter_body: String(row.completion_letter_body ?? ""),
    position: Math.floor(num(row.position, 0)),
    active: row.active !== false,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

/** Validate an admin-authored goal draft (used by the editor and the drafts route). */
export function validateGoalDraft(d: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (typeof d.slug !== "string" || !/^[a-z0-9-]{1,64}$/.test(d.slug)) errors.push("slug: lowercase letters, numbers, dashes");
  if (typeof d.title !== "string" || !d.title.trim() || d.title.length > 80) errors.push("title: 1-80 characters");
  if (d.goal_type !== "story" && d.goal_type !== "seasonal") errors.push("goal_type: story or seasonal");
  if (typeof d.target_points !== "number" || !Number.isInteger(d.target_points) || d.target_points < 1) errors.push("target_points: positive integer");
  const w = d.weights as Record<string, unknown> | undefined;
  if (!w || typeof w !== "object") errors.push("weights: object");
  else for (const k of Object.keys(DEFAULT_WEIGHTS)) if (typeof w[k] !== "number" || (w[k] as number) < 0) errors.push(`weights.${k}: number ≥ 0`);
  const c = d.caps as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object" || typeof c.member_total !== "number" || typeof c.delivery !== "number" || c.member_total < 0 || c.delivery < 0) errors.push("caps: member_total and delivery ≥ 0");
  if (!Array.isArray(d.accepts) || d.accepts.some((k) => !(DELIVERY_KINDS as readonly string[]).includes(String(k)))) errors.push("accepts: coins/material/specimen");
  const start = d.window_start ? Date.parse(String(d.window_start)) : NaN;
  const end = d.window_end ? Date.parse(String(d.window_end)) : NaN;
  if (d.goal_type === "seasonal" && (Number.isNaN(start) || Number.isNaN(end))) errors.push("seasonal goals need a window");
  if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) errors.push("window_end must be after window_start");
  return errors;
}
