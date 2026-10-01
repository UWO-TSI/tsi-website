"use client";

import { useEffect, useMemo, useState } from "react";
import { momentAt, type WorldMoment } from "@/lib/collections/logic";
import type { IslandWeather } from "./islandWeather";
import { bestOwnedRod, type RodTier } from "./rods";
import { ownsGlider } from "./glider";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import { installCollectionsDemo } from "./collectionsDemo";
import { createClient } from "@/lib/supabase/client";

installCollectionsDemo();

/**
 * Member seed for personal node rolls (hourly respawn is per member): the
 * account id, as the server rolls them (lib/collections/rolls.ts), else a
 * local per-device id. The rod is the best one in the server inventory: shop
 * tiers 2-3, crafted tiers 4-5 (lib/crafting). The same inventory says whether
 * the member owns the leaf glider (crafted only; lib/game/glider.ts).
 */
export function usePeacefulContext(weather: IslandWeather, now: number): { moment: WorldMoment; member: string; rod: RodTier; glider: boolean } {
  const [member, setMember] = useState(() => {
    try {
      const saved = localStorage.getItem("tsi.member.local.v1");
      if (saved) return saved;
      const id = `local-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem("tsi.member.local.v1", id);
      return id;
    } catch { return "local-guest"; }
  });
  useEffect(() => {
    try {
      void createClient().auth.getSession().then(({ data }) => { if (data.session) setMember(data.session.user.id); }, () => {});
    } catch { /* env-less preview: the local id */ }
  }, []);
  const [owned, setOwned] = useState<string[]>([]);
  useEffect(() => {
    // Signed out keeps the starter rod; a fresh craft (tsi:crafted) re-reads the inventory.
    const load = () => { httpEconomyTransport.inventory().then(inv => setOwned((inv.groups.tools ?? []).flatMap(r => r.item.catalogue_ref ?? [])), () => {}); };
    load();
    window.addEventListener("tsi:crafted", load);
    return () => window.removeEventListener("tsi:crafted", load);
  }, []);
  const rod = bestOwnedRod(owned), glider = ownsGlider(owned);
  // The same object for the whole hour (Toronto hours start on the UTC hour).
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  const moment = useMemo(() => momentAt(new Date(hourStart), weather), [hourStart, weather]);
  return { moment, member, rod, glider };
}
