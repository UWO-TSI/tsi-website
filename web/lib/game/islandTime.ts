import { phaseForSun, sunFor, type SunDay } from "./sunTimes";
import { torontoInstant, torontoParts } from "@/lib/time";

/**
 * Island clock: real campus time in Toronto (ledger rows 84, 88) with phases
 * set by real sunrise/sunset for London, Ontario (decision 173, sunTimes.ts).
 */
export type IslandPhase = "dawn" | "day" | "evening" | "night";
export const ISLAND_PHASES: readonly IslandPhase[] = ["dawn", "day", "evening", "night"];

/** Fractional hour (0-24) in America/Toronto for a given instant. */
export function torontoHour(date = new Date()): number {
  const t = torontoParts(date);
  return t.hour + t.minute / 60;
}

/** The phase at an instant, from the Toronto hour and that day's sun times (defaults to the fallback table). */
export function islandPhase(date = new Date(), days?: readonly SunDay[] | null): IslandPhase {
  return phaseForSun(torontoHour(date), sunFor(date, days));
}

/** Dev/QA override from the URL: `?time=dawn|day|evening|night` (spec §8.5; `?at=HH:MM` sets a clock). Null when absent or invalid. */
export function parseTimeOverride(value: string | null): IslandPhase | null {
  return value && (ISLAND_PHASES as readonly string[]).includes(value) ? value as IslandPhase : null;
}

/**
 * Dev/QA clock from the URL: `?at=HH:MM` (Toronto) with an optional
 * `&date=YYYY-MM-DD` (default: that day in Toronto). `at` may repeat, since
 * `?at=x,z` is the village's spawn point: `?at=0,-1&at=17:00`.
 */
export function parseClockOverride(params: URLSearchParams, now = new Date()): Date | null {
  const time = params.getAll("at").map(v => /^(\d{1,2}):(\d{2})$/.exec(v)).find(Boolean);
  if (!time || Number(time[1]) > 23 || Number(time[2]) > 59) return null;
  const day = params.get("date") ?? "";
  return torontoInstant(/^\d{4}-\d{2}-\d{2}$/.test(day) ? day : torontoParts(now).date, Number(time[1]) + Number(time[2]) / 60);
}
