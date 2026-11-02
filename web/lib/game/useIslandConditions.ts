"use client";

import { useEffect, useMemo, useState } from "react";
import { islandPhase, parseClockOverride, parseTimeOverride, torontoHour, type IslandPhase } from "./islandTime";
import { parseWeatherBlendOverride, parseWeatherOverride, setLiveIslandWeather, weatherAt, weatherBlendAt, type IslandWeather, type WeatherBlend, type WeatherReport } from "./islandWeather";
import { parseSeasonOverride, seasonBlend, type SeasonBlend } from "./season";
import { phaseBlend, setLiveSunDays, sunFor, type PhaseBlend } from "./sunTimes";
import { phaseInstant, solarPosition, SUN_STEP_MS, type SunAngles } from "./sunPath";
import { setWorldClockOffset, worldNow } from "./worldClock";

const DEV = process.env.NODE_ENV !== "production";
const search = () => (DEV && typeof window !== "undefined" ? window.location.search : "");

export interface IslandConditions {
  phase: IslandPhase;
  /** Forced phase from `?time=` or the options menu; null follows the real sun. */
  forcedPhase: IslandPhase | null;
  setForcedPhase: (phase: IslandPhase | null) => void;
  livePhase: IslandPhase;
  weather: IslandWeather;
  /** The weather with its transition (a new hour's eases in); `weather` is where it is going. */
  weatherBlend: WeatherBlend;
  season: SeasonBlend;
  sunSource: "open-meteo" | "fallback";
  /** The real sun (row 239) at world-clock time, or a forced phase's preview time; the same object until it moves a step. */
  sun: SunAngles;
  /** World-clock ms (worldNow, so `?at=` moves it), read once a minute: the events, forage and bugs follow it. */
  now: number;
  /** The light's phase blend (islandLightAt): across a boundary the two phases and how far; a forced phase is itself. */
  blend: PhaseBlend;
}

/**
 * Time of day (real London, Ontario sunrise/sunset), the sun's position,
 * weather and season for the island, from one /api/weather request refreshed
 * every 30 minutes and the world clock (worldClock.ts) read once a minute, so
 * every client computes the same sun. `?time=`, `?at=HH:MM&date=`,
 * `?weather=`/`?rain` and `?season=` override outside production. Client-only
 * component, so the URL is read on first render.
 */
export function useIslandConditions(): IslandConditions {
  const [forcedPhase, setForcedPhase] = useState<IslandPhase | null>(() => parseTimeOverride(new URLSearchParams(search()).get("time")));
  // `?at=HH:MM&date=` moves the world clock itself (from that time on), so the water, clouds and leaves agree with the sun.
  // Set before the first clock read below; the effect keeps it through a remount and restores real time on unmount.
  const [previewOffset] = useState(() => {
    const at = parseClockOverride(new URLSearchParams(search()));
    const offset = at && at.getTime() - Date.now();
    if (offset !== null) setWorldClockOffset(offset);
    return offset;
  });
  useEffect(() => {
    if (previewOffset === null) return;
    setWorldClockOffset(previewOffset);
    return () => setWorldClockOffset(0);
  }, [previewOffset]);
  const [weatherOverride] = useState(() => parseWeatherOverride(search()));
  const [weatherBlendOverride] = useState(() => parseWeatherBlendOverride(search()));
  const [seasonOverride] = useState(() => parseSeasonOverride(search()));
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [now, setNow] = useState(() => worldNow());
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/weather").then(r => r.ok ? r.json() : null).then((body: WeatherReport | null) => { if (alive && body) setReport(body); }).catch(() => {});
    load();
    const refresh = window.setInterval(load, 30 * 60_000);
    const tick = () => setNow(worldNow());
    const clock = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { alive = false; window.clearInterval(refresh); window.clearInterval(clock); document.removeEventListener("visibilitychange", tick); };
  }, []);
  const date = new Date(now);
  const livePhase = islandPhase(date, report?.sun);
  const sunStep = Math.floor((forcedPhase ? phaseInstant(forcedPhase, date, report?.sun) : date).getTime() / SUN_STEP_MS);
  const sun = useMemo(() => solarPosition(new Date(sunStep * SUN_STEP_MS)), [sunStep]);
  const weather = weatherOverride ?? (report && weatherAt(report, date)) ?? "clear";
  // Keyed by value, like the phase blend: rebuilt only while a transition moves.
  const liveWeather = weatherBlendOverride ?? (!weatherOverride && report ? weatherBlendAt(report, date) : null);
  const weatherKey = liveWeather && liveWeather.to === weather ? `${liveWeather.from} ${weather} ${Math.round(liveWeather.t * 1000) / 1000}` : `${weather} ${weather} 1`;
  const weatherBlend = useMemo((): WeatherBlend => {
    const [from, to, t] = weatherKey.split(" ");
    return { from: from as IslandWeather, to: to as IslandWeather, t: Number(t) };
  }, [weatherKey]);
  // Keyed by value, so the light is only rebuilt when the blend moves (once a minute across a boundary).
  const live = phaseBlend(torontoHour(date), sunFor(date, report?.sun));
  const blendKey = forcedPhase ? `${forcedPhase} ${forcedPhase} 0` : `${live.from} ${live.to} ${Math.round(live.t * 1000) / 1000}`;
  const blend = useMemo((): PhaseBlend => {
    const [from, to, t] = blendKey.split(" ");
    return { from: from as IslandPhase, to: to as IslandPhase, t: Number(t) };
  }, [blendKey]);
  // Footsteps and the reel read it outside React (liveIslandWeather).
  useEffect(() => setLiveIslandWeather(weather), [weather]);
  // Resident routines read the same sun times outside React.
  useEffect(() => setLiveSunDays(report?.sun ?? null), [report]);
  return {
    phase: forcedPhase ?? livePhase, forcedPhase, setForcedPhase, livePhase,
    weather,
    weatherBlend,
    season: seasonOverride ?? seasonBlend(date),
    sunSource: sunFor(date, report?.sun).source,
    sun,
    now,
    blend,
  };
}
