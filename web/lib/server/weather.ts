/**
 * Island weather on the server (row 153): hourly London, Ontario forecast from
 * Open-Meteo (free, keyless), cached 30 minutes; any failure gives the seeded
 * fallback, cached 5 minutes, so the island never waits on weather. /api/weather serves it, and
 * the catch rolls read the current hour from it, so both see the same sky.
 */
import { LONDON_ON, fallbackWeather, parseOpenMeteo, torontoHourKey, weatherAt, type IslandWeather, type WeatherHour, type WeatherReport } from "@/lib/game/islandWeather";
import { seasonBlend } from "@/lib/game/season";
import { parseSunDaily } from "@/lib/game/sunTimes";

const WEATHER_CACHE_MS = 30 * 60_000;
/** While Open-Meteo is failing, the fallback is kept this long, so catches don't each wait on the timeout. */
const FALLBACK_CACHE_MS = 5 * 60_000;
let cached: { until: number; report: WeatherReport } | null = null;

const URL_BASE = "https://api.open-meteo.com/v1/forecast";

function fallback(now: Date): WeatherReport {
  const hours: WeatherHour[] = [];
  for (let h = 0; h < 48; h++) {
    const at = new Date(now.getTime() + h * 3_600_000);
    hours.push({ time: torontoHourKey(at), state: fallbackWeather(at, seasonBlend(at).season) });
  }
  return { source: "fallback", hours };
}

export async function weatherReport(now = new Date()): Promise<WeatherReport> {
  if (cached && now.getTime() < cached.until) return cached.report;
  const url = `${URL_BASE}?latitude=${LONDON_ON.latitude}&longitude=${LONDON_ON.longitude}&hourly=weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=America%2FToronto&forecast_days=2`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const body: unknown = await res.json();
    const report: WeatherReport = { source: "open-meteo", hours: parseOpenMeteo(body) };
    try { report.sun = parseSunDaily(body); } catch { /* Phases fall back to the monthly table. */ }
    cached = { until: now.getTime() + WEATHER_CACHE_MS, report };
    return report;
  } catch {
    cached = { until: now.getTime() + FALLBACK_CACHE_MS, report: fallback(now) };
    return cached.report;
  }
}

/** This hour's island weather, as the world shows it (useIslandConditions). */
export async function islandWeatherNow(now = new Date()): Promise<IslandWeather> {
  return weatherAt(await weatherReport(now), now) ?? "clear";
}
