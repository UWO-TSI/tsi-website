/**
 * Island weather (ledger rows 152, 153, 160): Open-Meteo hourly forecast for
 * London, Ontario, mapped to five states. The server route caches the
 * forecast; when it is unavailable the seeded daily weather from `weather.ts`
 * is used, so every player still sees the same sky.
 */
import { weatherForDate, type Weather } from "./weather";
import type { Season } from "./season";
import type { SunDay } from "./sunTimes";
import { torontoParts } from "@/lib/time";

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
  return `${torontoParts(date).hourKey}:00`;
}

/** Roster weather words from the island's weather states (fog/wind read as cloudy). */
export function rosterWeather(weather: IslandWeather): "clear" | "cloudy" | "rain" | "snow" {
  return weather === "rain" ? "rain" : weather === "snow" ? "snow" : weather === "clear" ? "clear" : "cloudy";
}

/** Reel words (weatherPerks, fish hours) from the island's weather states. */
export function reelWeather(weather: IslandWeather): Weather {
  return weather === "rain" ? "rain" : weather === "clear" ? "sunny" : "cloudy";
}

/** The island weather the world shows now, published by useIslandConditions for code outside React (footsteps, the reel). */
let live: IslandWeather = "clear";
export const liveIslandWeather = (): IslandWeather => live;
export function setLiveIslandWeather(weather: IslandWeather): void {
  live = weather;
}

export function weatherAt(report: WeatherReport, date = new Date()): IslandWeather | null {
  const key = torontoHourKey(date);
  return report.hours.find(hour => hour.time === key)?.state ?? null;
}

/** QA override `?weather=snow` (or the legacy `?rain=1`); a transition `?weather=clear-rain:0.3` gives where it is going. */
export function parseWeatherOverride(search: string): IslandWeather | null {
  const blend = parseWeatherBlendOverride(search);
  if (blend) return blend.to;
  return new URLSearchParams(search).has("rain") ? "rain" : null;
}

/**
 * A change of weather caught part way (`t` 0 = `from`, 1 = `to`). The light, the sky and the wet ground ease across it
 * (islandLighting `weatherLight`); what falls (rain, snow) follows `to`.
 */
export interface WeatherBlend { from: IslandWeather; to: IslandWeather; t: number }
/** A new hour's weather eases in over its first minutes. */
export const WEATHER_EASE_MIN = 20;
const isWeather = (name?: string): name is IslandWeather => !!name && (ISLAND_WEATHERS as readonly string[]).includes(name);

/**
 * The weather at `date` with its transition: the hour's state, eased from the previous hour's over the first
 * WEATHER_EASE_MIN minutes. A function of the shared forecast and the world clock, so every player sees the same sky.
 */
export function weatherBlendAt(report: WeatherReport, date = new Date()): WeatherBlend | null {
  const to = weatherAt(report, date);
  if (!to) return null;
  const from = weatherAt(report, new Date(date.getTime() - 3_600_000)) ?? to;
  const u = Math.min(1, (date.getUTCMinutes() + date.getUTCSeconds() / 60) / WEATHER_EASE_MIN);
  return u >= 1 || from === to ? { from: to, to, t: 1 } : { from, to, t: u * u * (3 - 2 * u) };
}

/** QA override: `?weather=rain` (settled), or a transition `?weather=clear-rain` (half way) / `?weather=clear-rain:0.3`. */
export function parseWeatherBlendOverride(search: string): WeatherBlend | null {
  const value = new URLSearchParams(search).get("weather");
  if (!value) return null;
  const [pair, amount] = value.split(":"), [from, to] = pair.split("-");
  if (!isWeather(from) || (to !== undefined && !isWeather(to))) return null;
  if (to === undefined) return { from, to: from, t: 1 };
  const t = amount === undefined ? 0.5 : Number(amount);
  return Number.isFinite(t) ? { from, to, t: Math.min(1, Math.max(0, t)) } : null;
}
