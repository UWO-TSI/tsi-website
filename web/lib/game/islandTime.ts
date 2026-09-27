import { phaseForSun, sunFor, type SunDay } from "./sunTimes";
import { torontoParts } from "@/lib/time";

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

/** The instant a Toronto wall clock shows `hour` (0-24) on the Toronto day `day` ("YYYY-MM-DD"). */
export function torontoInstant(day: string, hour: number): Date {
  const [y, m, d] = day.split("-").map(Number), wall = Date.UTC(y, m - 1, d) + Math.round(hour * 60) * 60_000;
  const guess = new Date(wall + 5 * 3_600_000), t = torontoParts(guess); // EST; EDT shows an hour later
  return new Date(guess.getTime() + wall - Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute));
}

/** Phase for a Toronto hour on a date (defaults to today's fallback sun times). */
export function phaseForHour(hour: number, date = new Date(), days?: readonly SunDay[] | null): IslandPhase {
  return phaseForSun(hour, sunFor(date, days));
}

export function islandPhase(date = new Date(), days?: readonly SunDay[] | null): IslandPhase {
  return phaseForHour(torontoHour(date), date, days);
}

/**
 * Dev/QA override from the URL: `?time=dawn|day|evening|night` or an hour
 * (`?time=18.5`). Returns null when absent or invalid.
 */
export function parseTimeOverride(value: string | null, date = new Date()): IslandPhase | null {
  if (!value) return null;
  if ((ISLAND_PHASES as readonly string[]).includes(value)) return value as IslandPhase;
  const hour = Number(value);
  return Number.isFinite(hour) && hour >= 0 && hour <= 24 ? phaseForHour(hour, date) : null;
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
