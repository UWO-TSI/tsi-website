/**
 * Island weather (ledger rows 152, 153, 160): Open-Meteo hourly forecast for
 * London, Ontario, mapped to five states. The server route caches the
 * forecast; when it is unavailable the seeded daily weather from `weather.ts`
 * is used, so every player still sees the same sky.
 */
import { weatherForDate } from "./weather";
import type { Season } from "./season";
import type { SunDay } from "./sunTimes";

export type IslandWeather = "clear" | "rain" | "snow" | "fog" | "wind";
export const ISLAND_WEATHERS: readonly IslandWeather[] = ["clear", "rain", "snow", "fog", "wind"];
export const LONDON_ON = { latitude: 42.9849, longitude: -81.2453 };
/** Sustained wind (km/h) that reads as a windy day. */
export const WINDY_KMH = 30;

/**
 * WMO weather interpretation code (Open-Meteo `weather_code`) plus wind to a
 * state. Precipitation outranks wind, wind outranks cloud.
 * https://open-meteo.com/en/docs (WMO codes table)
 */
export function weatherFromCode(code: number, windKmh = 0): IslandWeather {
  if (code === 45 || code === 48) return "fog";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  if (windKmh >= WINDY_KMH) return "wind";
  return "clear";
}

/** Deterministic fallback from the existing seeded daily weather. */
export function fallbackWeather(date: Date, season: Season): IslandWeather {
  const daily = weatherForDate(date);
  if (daily === "rain") return season === "winter" ? "snow" : "rain";
  return "clear";
}

export interface WeatherHour { time: string; state: IslandWeather }
export interface WeatherReport { source: "open-meteo" | "fallback"; hours: WeatherHour[]; /** Daily sunrise/sunset; absent on fallback. */ sun?: SunDay[] }

/** Map an Open-Meteo hourly payload; throws on a malformed body. */
export function parseOpenMeteo(body: unknown): WeatherHour[] {
  const hourly = (body as { hourly?: { time?: unknown; weather_code?: unknown; wind_speed_10m?: unknown } })?.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.weather_code)) throw new Error("Malformed Open-Meteo response");
  const codes: unknown[] = hourly.weather_code;
  const wind: unknown[] = Array.isArray(hourly.wind_speed_10m) ? hourly.wind_speed_10m : [];
  return hourly.time.map((time, i) => ({
    time: String(time),
    state: weatherFromCode(Number(codes[i]), Number(wind[i] ?? 0)),
  }));
}

/** Toronto-local "YYYY-MM-DDTHH:00", the format Open-Meteo returns with timezone=America/Toronto. */
export function torontoHourKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:00`;
}

export function weatherAt(report: WeatherReport, date = new Date()): IslandWeather | null {
  const key = torontoHourKey(date);
  return report.hours.find(hour => hour.time === key)?.state ?? null;
}

/** QA override `?weather=snow` (or the legacy `?rain=1`). */
export function parseWeatherOverride(search: string): IslandWeather | null {
  const params = new URLSearchParams(search);
  const value = params.get("weather");
  if (value && (ISLAND_WEATHERS as readonly string[]).includes(value)) return value as IslandWeather;
  return params.has("rain") ? "rain" : null;
}
