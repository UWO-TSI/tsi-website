"use client";

import { useEffect, useMemo, useState } from "react";
import { islandPhase, parseClockOverride, parseTimeOverride, type IslandPhase } from "./islandTime";
import { parseWeatherOverride, weatherAt, type IslandWeather, type WeatherReport } from "./islandWeather";
import { parseSeasonOverride, seasonBlend, type SeasonBlend } from "./season";
import { sunFor } from "./sunTimes";
import { phaseInstant, solarPosition, SUN_STEP_MS, type SunAngles } from "./sunPath";

const DEV = process.env.NODE_ENV !== "production";
const search = () => (DEV && typeof window !== "undefined" ? window.location.search : "");

export interface IslandConditions {
  phase: IslandPhase;
  /** Forced phase from `?time=` or the options menu; null follows the real sun. */
  forcedPhase: IslandPhase | null;
  setForcedPhase: (phase: IslandPhase | null) => void;
  livePhase: IslandPhase;
  weather: IslandWeather;
  season: SeasonBlend;
  sunSource: "open-meteo" | "fallback";
  /** The real sun (row 239): now, the forced clock, or a forced phase's preview time; the same object until it moves a step. */
  sun: SunAngles;
}

/**
 * Time of day (real London, Ontario sunrise/sunset), the sun's position,
 * weather and season for the island, from one /api/weather request refreshed
 * every 30 minutes and a one-minute clock. `?time=`, `?at=HH:MM&date=`,
 * `?weather=`/`?rain` and `?season=` override outside production. Client-only
 * component, so the URL is read on first render.
 */
export function useIslandConditions(): IslandConditions {
  const [forcedPhase, setForcedPhase] = useState<IslandPhase | null>(() => parseTimeOverride(new URLSearchParams(search()).get("time")));
  const [clockOverride] = useState(() => parseClockOverride(new URLSearchParams(search())));
  const [weatherOverride] = useState(() => parseWeatherOverride(search()));
  const [seasonOverride] = useState(() => parseSeasonOverride(search()));
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/weather").then(r => r.ok ? r.json() : null).then((body: WeatherReport | null) => { if (alive && body) setReport(body); }).catch(() => {});
    load();
    const refresh = window.setInterval(load, 30 * 60_000);
    const tick = () => setNow(Date.now());
    const clock = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { alive = false; window.clearInterval(refresh); window.clearInterval(clock); document.removeEventListener("visibilitychange", tick); };
  }, []);
  const date = clockOverride ?? new Date(now);
  const livePhase = islandPhase(date, report?.sun);
  const sunStep = Math.floor((forcedPhase ? phaseInstant(forcedPhase, date, report?.sun) : date).getTime() / SUN_STEP_MS);
  const sun = useMemo(() => solarPosition(new Date(sunStep * SUN_STEP_MS)), [sunStep]);
  return {
    phase: forcedPhase ?? livePhase, forcedPhase, setForcedPhase, livePhase,
    weather: weatherOverride ?? (report && weatherAt(report, date)) ?? "clear",
    season: seasonOverride ?? seasonBlend(date),
    sunSource: sunFor(date, report?.sun).source,
    sun,
  };
}
