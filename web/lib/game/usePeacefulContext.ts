"use client";

import { useMemo, useState } from "react";
import type { WorldMoment } from "@/lib/collections/logic";
import type { IslandWeather } from "./islandWeather";
import { torontoHour } from "./islandTime";
import { bestOwnedRod, rodByTier, type RodTier } from "./rods";
import { localGear } from "./gear";
import { installCollectionsDemo } from "./collectionsDemo";

installCollectionsDemo();

/** Roster weather words from the island's weather states (fog/wind read as cloudy). */
export function rosterWeather(weather: IslandWeather): WorldMoment["weather"] {
  return weather === "rain" ? "rain" : weather === "snow" ? "snow" : weather === "clear" ? "clear" : "cloudy";
}

/**
 * Member seed for personal node rolls (hourly respawn is per member). A local
 * per-device id until the account id is threaded through; `?rod=<1-5>` picks a
 * rod tier outside production.
 */
export function usePeacefulContext(weather: IslandWeather, now: number): { moment: WorldMoment; member: string; rod: RodTier } {
  const [member] = useState(() => {
    try {
      const saved = localStorage.getItem("tsi.member.local.v1");
      if (saved) return saved;
      const id = `local-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("tsi.member.local.v1", id);
      return id;
    } catch { return "local-guest"; }
  });
  const [rod] = useState(() => {
    const dev = process.env.NODE_ENV !== "production" && typeof window !== "undefined" ? Number(new URLSearchParams(window.location.search).get("rod")) : 0;
    return dev ? rodByTier(dev) : bestOwnedRod(typeof window === "undefined" ? [] : localGear());
  });
  const date = new Date(now);
  const hour = Math.floor(torontoHour(date));
  const month = date.getMonth() + 1;
  const moment = useMemo(() => ({ hour: hour + 0.5, month, weather: rosterWeather(weather) }), [hour, month, weather]);
  return { moment, member, rod };
}
