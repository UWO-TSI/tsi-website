/**
 * Seasonal events (specs/seasonal-events.md, rows 96, 184, 204, 212): which
 * event is running, which catches it gates, and the fishing tourney board.
 * Pure; the catch route, /api/collections/tourney and the island share it.
 * An event is a seasonal club goal plus its `event` (types.ts GoalEvent).
 */
import { goalCycle } from "./goals";
import type { ClubGoal, GoalEvent } from "./types";

/** The decoration sets the island knows (components/game/SeasonalEvents.tsx). */
export const DECOR_SETS: Record<string, string> = {
  "fall-tourney": "Fall fishing tourney",
  "winter-lights": "Winter lights",
  genesis: "GENESIS week",
  "spring-picnic": "Spring blossom picnic",
};

type EventGoal = Pick<ClubGoal, "slug" | "title" | "goal_type" | "window_start" | "window_end"> & { event: GoalEvent; active?: boolean; position?: number };

/** Is this seasonal goal's window open at `now`? (Listed goals are active unless they say otherwise.) */
export function eventOpen(goal: EventGoal, now: Date): boolean {
  return goal.goal_type === "seasonal" && goalCycle({ ...goal, active: goal.active !== false }, now).open;
}

/** The event the village dresses for: the first open seasonal goal with a decoration set. */
export function runningEvent<G extends EventGoal>(goals: readonly G[], now: Date): G | null {
  return goals.find((g) => g.event.decor && eventOpen(g, now)) ?? null;
}

/** Limited-time catches: every species some seasonal goal gates, and the ones biting now. */
export function eventCatches(goals: readonly EventGoal[], now: Date): { limited: Set<string>; open: Set<string> } {
  const seasonal = goals.filter((g) => g.goal_type === "seasonal");
  return {
    limited: new Set(seasonal.flatMap((g) => g.event.catches)),
    open: new Set(seasonal.filter((g) => eventOpen(g, now)).flatMap((g) => g.event.catches)),
  };
}

export type CatchRule = { ok: true; tourney: { goal_id: string; cycle: number } | null } | { ok: false; event: string };

/**
 * What a catch at `now` may do: a limited-time species outside its event is
 * refused (the pool never offers it, so only a forged request gets here); a
 * catch during an open tourney also enters it.
 */
export function catchRule(goals: readonly (EventGoal & { id: string })[], itemKey: string, now: Date): CatchRule {
  const gating = goals.filter((g) => g.goal_type === "seasonal" && g.event.catches.includes(itemKey));
  if (gating.length && !gating.some((g) => eventOpen(g, now))) return { ok: false, event: gating[0].title };
  const t = goals.find((g) => g.event.tourney && eventOpen(g, now));
  return { ok: true, tourney: t ? { goal_id: t.id, cycle: goalCycle({ ...t, active: true }, now).cycle } : null };
}

/** The tourney the board shows: the open one, else the one that ran most recently (until the next opens). */
export function latestTourney<G extends EventGoal & { id: string }>(goals: readonly G[], now: Date): { goal: G; cycle: number; open: boolean; start: Date | null; end: Date | null } | null {
  let best: { goal: G; cycle: number; open: boolean; start: Date | null; end: Date | null } | null = null;
  for (const goal of goals) {
    if (goal.goal_type !== "seasonal" || !goal.event.tourney) continue;
    const c = goalCycle({ ...goal, active: goal.active !== false }, now);
    if (!c.start || c.start > now) continue;
    if (!best || c.start > best.start!) best = { goal, cycle: c.cycle, open: c.open, start: c.start, end: c.end };
  }
  return best;
}

// ─── The tourney board (design principle 6) ─────────────────────────────────

export const TOURNEY_CATEGORIES = ["fish", "sea"] as const;
export type TourneyCategory = (typeof TOURNEY_CATEGORIES)[number];

/** A member's biggest catch in one category this tourney (a tourney_entries row with the member's name). */
export interface TourneyEntry {
  member_id: string;
  member_name: string;
  category: TourneyCategory;
  item_key: string;
  size_cm: number;
  caught_at: string;
}
/** A board row. Unnamed rows carry only rank and size. */
export interface TourneyRow {
  rank: number;
  size_cm: number;
  name: string | null;
  species: string | null;
  mine: boolean;
}
export interface TourneyBoard {
  category: TourneyCategory;
  entrants: number;
  /** The top half (rounded up), by name. */
  top: TourneyRow[];
  /** The caller's own row wherever it ranks, or null if they haven't entered. */
  me: TourneyRow | null;
  /** Bottom half only: up to two unnamed neighbours either side of the caller. */
  around: TourneyRow[];
}

/**
 * Biggest catch wins; the earlier catch breaks a tie. The top half is public
 * by name; below it a member sees only their own row and their nearest
 * neighbours, unnamed. Nobody else's member id ever leaves the server.
 */
export function tourneyBoards(entries: readonly TourneyEntry[], memberId: string, speciesName: (key: string) => string): TourneyBoard[] {
  return TOURNEY_CATEGORIES.map((category) => {
    const ranked = entries.filter((e) => e.category === category).sort((a, b) => b.size_cm - a.size_cm || a.caught_at.localeCompare(b.caught_at));
    const half = Math.ceil(ranked.length / 2);
    const named = (e: TourneyEntry, i: number): TourneyRow => ({ rank: i + 1, size_cm: e.size_cm, name: e.member_name, species: speciesName(e.item_key), mine: e.member_id === memberId });
    const mine = ranked.findIndex((e) => e.member_id === memberId);
    const around = mine >= half
      ? ranked.slice(Math.max(half, mine - 2), mine + 3).flatMap((e, j) => {
          const i = Math.max(half, mine - 2) + j;
          return i === mine ? [] : [{ rank: i + 1, size_cm: e.size_cm, name: null, species: null, mine: false }];
        })
      : [];
    return { category, entrants: ranked.length, top: ranked.slice(0, half).map(named), me: mine >= 0 ? named(ranked[mine], mine) : null, around };
  });
}
