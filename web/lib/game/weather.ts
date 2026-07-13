/**
 * Daily weather (rain days v1, approved big swing #21, 2026-07-12).
 *
 * Deterministic per-calendar-day: every player sees the same weather on the
 * same date with zero backend. ~22% of days rain. `?rain=1` / `?sunny=1`
 * force either state for testing and screenshots.
 *
 * The hash is one mulberry32 scramble of yyyymmdd — cheap, stable, and the
 * same trick the ambience seeds use. Phase 2 can swap this for an
 * admin-scheduled weather calendar (principle #8) without touching callers:
 * everything reads the Weather type, not the hash.
 */

export type Weather = "sunny" | "rain";

export function weatherForDate(d: Date): Weather {
  const key = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let t = key + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return r < 0.22 ? "rain" : "sunny";
}

/** Client-only convenience: today's weather with URL overrides. */
export function getTodayWeather(): Weather {
  if (typeof window !== "undefined") {
    const q = window.location.search;
    if (q.includes("rain")) return "rain";
    if (q.includes("sunny")) return "sunny";
  }
  return weatherForDate(new Date());
}
