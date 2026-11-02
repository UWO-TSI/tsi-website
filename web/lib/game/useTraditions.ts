"use client";

/**
 * The traditions running now, on the island (lib/content/traditions.ts): the calendar's rows read once (everyone can
 * read them; the seeded ones when the table can't be), checked against the world clock's minute, so every client
 * (and `?at=HH:MM&date=` previews) agrees. What it switches on is world state: pumpkins, the costume closet,
 * trick-or-treat, fog nights.
 *
 * Dev override (never in production): `?tradition=halloween` dresses the island for that tradition whatever the date,
 * `?tradition=none` for none.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";
import { setEventsOpen } from "@/lib/game/character/look";
import { DEFAULT_TRADITIONS, TRADITION_CONTENT, contentOn, costumeEvents, normalizeTradition, runningTraditions, type Tradition, type TraditionContent } from "@/lib/content/traditions";

const hasSupabase = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchTraditions(): Promise<Tradition[]> {
  if (!hasSupabase()) return [...DEFAULT_TRADITIONS];
  try {
    const { data, error } = await createClient().from("traditions").select("*").eq("active", true);
    return error || !data ? [...DEFAULT_TRADITIONS] : (data as Record<string, unknown>[]).map(normalizeTradition);
  } catch {
    return [...DEFAULT_TRADITIONS];
  }
}

export function parseTraditionOverride(search: string, production = process.env.NODE_ENV === "production"): string | null {
  if (production) return null;
  const v = new URLSearchParams(search).get("tradition");
  return v && /^[a-z0-9-]{1,40}$/.test(v) ? v : null;
}

export interface TraditionsNow { running: Tradition[]; content: Required<TraditionContent>; costumes: Set<string> }
const NONE: TraditionsNow = { running: [], content: Object.fromEntries(TRADITION_CONTENT.map(k => [k, false])) as Required<TraditionContent>, costumes: new Set() };

/** What's on now, from the rows and an override (pure: the hook and the tests). */
export function traditionsAt(rows: readonly Tradition[], epochMs: number, override: string | null): TraditionsNow {
  if (override === "none") return NONE;
  if (override) {
    const t = rows.find(r => r.id === override) ?? DEFAULT_TRADITIONS.find(r => r.id === override);
    if (!t) return NONE;
    const forced = { ...t, starts_on: "01-01", ends_on: "12-31", active: true };
    return { running: [forced], content: contentOn([forced], epochMs), costumes: costumeEvents([forced], epochMs) };
  }
  return { running: runningTraditions(rows, epochMs), content: contentOn(rows, epochMs), costumes: costumeEvents(rows, epochMs) };
}

// The costume events open now, for what isn't a React child of the island (the wardrobe, the character's parts).
let openCostumes: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
export const costumeEventsOpen = () => openCostumes;
export function setCostumeEventsOpen(events: ReadonlySet<string>): void {
  if (events.size === openCostumes.size && [...events].every(e => openCostumes.has(e))) return;
  openCostumes = new Set(events);
  setEventsOpen(openCostumes);
  listeners.forEach(l => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** The costume events open now (a hook for the wardrobe). */
export const useCostumeEventsOpen = () => useSyncExternalStore(subscribe, costumeEventsOpen, costumeEventsOpen);

/** `now`: the world clock read once a minute (useIslandConditions). */
export function useTraditions(now: number): TraditionsNow {
  const { data } = useSWR<Tradition[]>("traditions", fetchTraditions, { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 });
  const rows = data ?? DEFAULT_TRADITIONS;
  const [override] = useState(() => (typeof window === "undefined" ? null : parseTraditionOverride(window.location.search)));
  const minute = Math.floor(now / 60_000);
  const on = useMemo(() => traditionsAt(rows, minute * 60_000, override), [rows, minute, override]);
  useEffect(() => setCostumeEventsOpen(on.costumes), [on.costumes]);
  return on;
}
