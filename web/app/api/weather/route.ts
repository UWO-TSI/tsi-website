import { NextResponse } from "next/server";
import { LONDON_ON, fallbackWeather, parseOpenMeteo, torontoHourKey, type WeatherHour, type WeatherReport } from "@/lib/game/islandWeather";
import { seasonBlend } from "@/lib/game/season";
import { parseSunDaily } from "@/lib/game/sunTimes";

/**
 * GET /api/weather — hourly island weather for London, Ontario.
 * Also returns daily sunrise/sunset for the lighting phases.
 * Open-Meteo is free and keyless; the forecast is cached for 30 minutes here
 * and at the CDN. Any failure returns the seeded fallback with 200 so the
 * island never waits on weather.
 */
const CACHE_MS = 30 * 60_000;
let cached: { at: number; report: WeatherReport } | null = null;

const URL_BASE = "https://api.open-meteo.com/v1/forecast";

function fallback(now: Date): WeatherReport {
  const hours: WeatherHour[] = [];
  for (let h = 0; h < 48; h++) {
    const at = new Date(now.getTime() + h * 3_600_000);
    hours.push({ time: torontoHourKey(at), state: fallbackWeather(at, seasonBlend(at).season) });
  }
  return { source: "fallback", hours };
}

export async function GET() {
  const now = new Date();
  if (cached && now.getTime() - cached.at < CACHE_MS) return respond(cached.report);
  const url = `${URL_BASE}?latitude=${LONDON_ON.latitude}&longitude=${LONDON_ON.longitude}&hourly=weather_code,wind_speed_10m&daily=sunrise,sunset&timezone=America%2FToronto&forecast_days=2`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: CACHE_MS / 1000 } });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const body: unknown = await res.json();
    const report: WeatherReport = { source: "open-meteo", hours: parseOpenMeteo(body) };
    try { report.sun = parseSunDaily(body); } catch { /* Phases fall back to the monthly table. */ }
    cached = { at: now.getTime(), report };
    return respond(report);
  } catch {
    return respond(fallback(now));
  }
}

function respond(report: WeatherReport) {
  return NextResponse.json(report, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
