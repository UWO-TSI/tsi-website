/**
 * Real sunrise/sunset for London, Ontario (decision 173). Open-Meteo's daily
 * `sunrise`/`sunset` arrive through /api/weather; when they are missing the
 * per-month table below is used. Hours are Toronto local time.
 */
import type { IslandPhase } from "./islandTime";
import { torontoParts } from "@/lib/time";

export interface SunDay { date: string; sunrise: number; sunset: number }

/**
 * Mid-month sunrise/sunset in Toronto local time (with DST), computed with the
 * NOAA solar equations for 42.98 N, 81.25 W. Checked against Open-Meteo on
 * 2026-09-24 (07:14 / 19:18 vs table-day 07:13 / 19:21).
 */
export const SUN_FALLBACK: readonly { sunrise: number; sunset: number }[] = [
  { sunrise: 7.89, sunset: 17.23 }, { sunrise: 7.4, sunset: 17.91 }, { sunrise: 7.65, sunset: 19.5 },
  { sunrise: 6.75, sunset: 20.1 }, { sunrise: 6.04, sunset: 20.66 }, { sunrise: 5.75, sunset: 21.08 },
  { sunrise: 5.98, sunset: 21.05 }, { sunrise: 6.5, sunset: 20.49 }, { sunrise: 7.05, sunset: 19.62 },
  { sunrise: 7.61, sunset: 18.74 }, { sunrise: 7.28, sunset: 17.05 }, { sunrise: 7.82, sunset: 16.85 },
];

/** Dawn is the hour before sunrise; evening (golden hour) runs from one hour before to one hour after sunset (David, 2026-09-24). */
export const DAWN_HOURS = 1;
export const EVENING_HALF_HOURS = 1;

export function phaseForSun(hour: number, sun: { sunrise: number; sunset: number }): IslandPhase {
  const h = ((hour % 24) + 24) % 24;
  if (h >= sun.sunrise - DAWN_HOURS && h < sun.sunrise) return "dawn";
  if (h >= sun.sunrise && h < sun.sunset - EVENING_HALF_HOURS) return "day";
  if (h >= sun.sunset - EVENING_HALF_HOURS && h < sun.sunset + EVENING_HALF_HOURS) return "evening";
  return "night";
}

/** "2026-09-24T07:14" → 7.233 */
export function localIsoHour(iso: string): number {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) throw new Error(`Bad time ${iso}`);
  return Number(match[1]) + Number(match[2]) / 60;
}

/** Map Open-Meteo `daily` into SunDay rows; throws on a malformed body. */
export function parseSunDaily(body: unknown): SunDay[] {
  const daily = (body as { daily?: { time?: unknown; sunrise?: unknown; sunset?: unknown } })?.daily;
  if (!daily || !Array.isArray(daily.time) || !Array.isArray(daily.sunrise) || !Array.isArray(daily.sunset)) throw new Error("Malformed daily sun");
  const rises: unknown[] = daily.sunrise, sets: unknown[] = daily.sunset;
  return daily.time.map((date, i) => ({ date: String(date), sunrise: localIsoHour(String(rises[i])), sunset: localIsoHour(String(sets[i])) }));
}

/** Toronto calendar date "YYYY-MM-DD" and month index for an instant. */
export function torontoDate(date: Date): { key: string; month: number } {
  const t = torontoParts(date);
  return { key: t.date, month: t.month - 1 };
}

/** Today's sun times: the forecast day if present, else the monthly fallback. */
export function sunFor(date: Date, days?: readonly SunDay[] | null): { sunrise: number; sunset: number; source: "open-meteo" | "fallback" } {
  const { key, month } = torontoDate(date);
  const day = days?.find(d => d.date === key);
  return day ? { sunrise: day.sunrise, sunset: day.sunset, source: "open-meteo" } : { ...SUN_FALLBACK[month], source: "fallback" };
}

/** The latest forecast sun days (useIslandConditions sets them): routines outside React read the same sun times. */
let liveDays: readonly SunDay[] | null = null;
export function setLiveSunDays(days: readonly SunDay[] | null): void { liveDays = days; }
export function liveSunDays(): readonly SunDay[] | null { return liveDays; }

/** Minutes either side of a phase boundary over which the light blends from one phase's look to the next. */
export const PHASE_BLEND_MIN = 20;
/** Two phases and how far from the first to the second (0..1): the light at an hour, blended across each boundary. */
export interface PhaseBlend { from: IslandPhase; to: IslandPhase; t: number }
/**
 * The phase blend at a Toronto hour: the phase alone away from its edges, and across each boundary (dawn's start,
 * sunrise, golden hour's start and end) a smooth blend over PHASE_BLEND_MIN either side, so the light never steps.
 */
export function phaseBlend(hour: number, sun: { sunrise: number; sunset: number }): PhaseBlend {
  const h = ((hour % 24) + 24) % 24, w = PHASE_BLEND_MIN / 60;
  const edges: [number, IslandPhase, IslandPhase][] = [
    [sun.sunrise - DAWN_HOURS, "night", "dawn"], [sun.sunrise, "dawn", "day"],
    [sun.sunset - EVENING_HALF_HOURS, "day", "evening"], [sun.sunset + EVENING_HALF_HOURS, "evening", "night"],
  ];
  for (const [at, from, to] of edges) {
    const d = h - at;
    if (Math.abs(d) < w) { const u = (d + w) / (2 * w); return { from, to, t: u * u * (3 - 2 * u) }; }
  }
  const phase = phaseForSun(h, sun);
  return { from: phase, to: phase, t: 0 };
}
