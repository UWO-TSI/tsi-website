"use client";

import { useEffect, useMemo, useState } from "react";
import { momentAt, type WorldMoment } from "@/lib/collections/logic";
import type { IslandWeather } from "./islandWeather";
import { bestOwnedRod, rig, tackleByKey, type RodTier } from "./rods";
import { ownsGlider } from "./glider";
import { httpEconomyTransport } from "@/lib/wallet/transport";
import { installCollectionsDemo } from "./collectionsDemo";
import { createClient } from "@/lib/supabase/client";

installCollectionsDemo();

/**
 * Member seed for personal node rolls (hourly respawn is per member): the
 * account id, as the server rolls them (lib/collections/rolls.ts), else a
 * local per-device id. `owned` is the server inventory's gear keys (the wheel's
 * tools, lib/game/tools.ts); `rod` the best rod among them: shop tiers 2-3,
 * crafted tiers 4-5 (lib/crafting). The same inventory says whether the member
 * owns the leaf glider (crafted only; lib/game/glider.ts), and `tackle` is the add-ons equipped on the rod (rods.ts).
 */
export function usePeacefulContext(weather: IslandWeather, now: number): { moment: WorldMoment; member: string; rod: RodTier; glider: boolean; owned: readonly string[]; tackle: readonly string[] } {
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
  const [tackle, setTackle] = useState<string[]>([]);
  useEffect(() => {
    // Signed out keeps the starter rod; a fresh craft (tsi:crafted) re-reads the inventory.
    // Gear keys: rods and the glider by catalogue_ref, nets and shovels by slug (lib/game/tools.ts).
    const load = () => {
      httpEconomyTransport.inventory().then(inv => {
        const tools = inv.groups.tools ?? [];
        setOwned(tools.flatMap(r => [r.item.slug, r.item.catalogue_ref ?? []].flat()));
        setTackle(tools.flatMap(r => (r.equipped && tackleByKey(r.item.catalogue_ref) ? [r.item.catalogue_ref!] : [])));
      }, () => {});
    };
    load();
    // A resident handed a tool over (row 312, POST /api/world/tools): it's in the inventory now.
    window.addEventListener("tsi:crafted", load);
    window.addEventListener("tsi:tools-changed", load);
    // Bought or equipped gear (the shop, the bag): the rod's add-ons may have changed.
    window.addEventListener("tsi:gear-changed", load);
    return () => { window.removeEventListener("tsi:crafted", load); window.removeEventListener("tsi:tools-changed", load); window.removeEventListener("tsi:gear-changed", load); };
  }, []);
  const rod = rig(bestOwnedRod(owned), tackle), glider = ownsGlider(owned);
  // The same object for the whole hour (Toronto hours start on the UTC hour).
  const hourStart = Math.floor(now / 3_600_000) * 3_600_000;
  const moment = useMemo(() => momentAt(new Date(hourStart), weather), [hourStart, weather]);
  return { moment, member, rod, glider, owned, tackle };
}
