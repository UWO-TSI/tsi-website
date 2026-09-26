/**
 * Real sunrise/sunset for London, Ontario (decision 173). Open-Meteo's daily
 * `sunrise`/`sunset` arrive through /api/weather; when they are missing the
 * per-month table below is used. Hours are Toronto local time.
 */
import type { IslandPhase } from "./islandTime";

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
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "01";
  return { key: `${get("year")}-${get("month")}-${get("day")}`, month: Number(get("month")) - 1 };
}

/** Today's sun times: the forecast day if present, else the monthly fallback. */
export function sunFor(date: Date, days?: readonly SunDay[] | null): { sunrise: number; sunset: number; source: "open-meteo" | "fallback" } {
  const { key, month } = torontoDate(date);
  const day = days?.find(d => d.date === key);
  return day ? { sunrise: day.sunrise, sunset: day.sunset, source: "open-meteo" } : { ...SUN_FALLBACK[month], source: "fallback" };
}
