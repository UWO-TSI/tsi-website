"use client";

/**
 * The seasonal event the island is dressed for (specs/seasonal-events.md): the
 * open seasonal club goal with a decoration set, read at world-clock time so
 * every client (and `?at=HH:MM&date=` previews) agrees. Also tells the fishing
 * pool which limited-time catches are biting.
 *
 * Dev override (never in production): `?event=fall-tourney|winter-lights|genesis|spring-picnic`
 * forces that event's dressing (with its goal, when one has that set), `?event=none` clears it.
 */
import { useEffect, useMemo, useState } from "react";
import { useProgression } from "@/lib/progression/useProgression";
import { DECOR_SETS, eventCatches, runningEvent } from "@/lib/progression/seasonal";
import { SEASONAL_GOALS } from "@/lib/progression/defaults";
import type { GoalProgressView } from "@/lib/progression/types";
import { setEventCatches } from "./fishing";

export type EventGoal = Pick<GoalProgressView, "slug" | "title" | "event">;
export interface IslandEvent {
  decor: string;
  goal: EventGoal;
}

export function parseEventOverride(search: string, isProduction = process.env.NODE_ENV === "production"): string | null {
  if (isProduction) return null;
  const value = new URLSearchParams(search).get("event");
  return value === "none" || (value && DECOR_SETS[value]) ? value : null;
}

/** `now`: the world clock read once a minute (useIslandConditions). */
export function useIslandEvent(now: number): IslandEvent | null {
  const { state } = useProgression();
  const [override] = useState(() => (typeof window === "undefined" ? null : parseEventOverride(window.location.search)));
  // Re-read on the minute, not every render: the goals list is rebuilt on each progression refresh.
  const minute = Math.floor(now / 60_000);
  const event = useMemo<IslandEvent | null>(() => {
    if (override === "none") return null;
    if (override) {
      const goal = state.goals.find((g) => g.event.decor === override) ?? SEASONAL_GOALS.find((g) => g.event.decor === override)!;
      return { decor: override, goal };
    }
    const goal = runningEvent(state.goals, new Date(minute * 60_000));
    return goal?.event.decor ? { decor: goal.event.decor, goal } : null;
  }, [override, state.goals, minute]);
  useEffect(() => {
    const catches = eventCatches(state.goals, new Date(minute * 60_000));
    // A forced event bites its own limited-time catches too (screenshots, QA).
    setEventCatches(override && event ? { limited: catches.limited, open: new Set(event.goal.event.catches) } : catches);
  }, [state.goals, minute, override, event]);
  return event;
}
