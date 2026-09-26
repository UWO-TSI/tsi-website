"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorldMoment } from "@/lib/collections/logic";
import type { IslandWeather } from "./islandWeather";
import { torontoParts } from "@/lib/time";
import { bestOwnedRod, type RodTier } from "./rods";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import { installCollectionsDemo } from "./collectionsDemo";

installCollectionsDemo();

/** Roster weather words from the island's weather states (fog/wind read as cloudy). */
export function rosterWeather(weather: IslandWeather): WorldMoment["weather"] {
  return weather === "rain" ? "rain" : weather === "snow" ? "snow" : weather === "clear" ? "clear" : "cloudy";
}

/**
 * Member seed for personal node rolls (hourly respawn is per member). A local
 * per-device id until the account id is threaded through. The rod is the best
 * one in the server inventory: shop tiers 2-3, crafted tiers 4-5 (lib/crafting).
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
  const [owned, setOwned] = useState<string[]>([]);
  useEffect(() => {
    // Signed out keeps the starter rod; a fresh craft (tsi:crafted) re-reads the inventory.
    const load = () => { httpEconomyTransport.inventory().then(inv => setOwned((inv.groups.tools ?? []).flatMap(r => r.item.catalogue_ref ?? [])), () => {}); };
    load();
    window.addEventListener("tsi:crafted", load);
    return () => window.removeEventListener("tsi:crafted", load);
  }, []);
  const rod = bestOwnedRod(owned);
  const { hour, month } = torontoParts(new Date(now));
  const moment = useMemo(() => ({ hour: hour + 0.5, month, weather: rosterWeather(weather) }), [hour, month, weather]);
  return { moment, member, rod };
}
