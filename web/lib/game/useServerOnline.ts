"use client";
import useSWR from "swr";

/**
 * Sprint F1.3 — server-list data hook for the hold-Tab overlay.
 * Only polls while `active` is true (overlay visible). When closed the
 * SWR key is null, so no fetch is scheduled.
 */

export interface OnlinePlayer {
  user_id: string;
  display_name: string;
  level: number;
  class: string | null;
  tier: number;
  recorded_at: string;
}
export interface OnlineNPC {
  id: string;
  display_name: string;
  spawn_zone: string;
  is_permanent: boolean;
}
export interface UpcomingEvent {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
}

interface OnlineData {
  online: OnlinePlayer[];
  recent: OnlinePlayer[];
  npcs: OnlineNPC[];
  events: UpcomingEvent[];
}

const EMPTY: OnlineData = { online: [], recent: [], npcs: [], events: [] };
const ONE_MIN = 60_000;

async function fetcher(): Promise<OnlineData> {
  try {
    const res = await fetch("/api/server/online");
    if (!res.ok) return EMPTY;
    return (await res.json()) as OnlineData;
  } catch {
    return EMPTY;
  }
}

export function useServerOnline(active: boolean) {
  const { data, isLoading } = useSWR<OnlineData>(
    active ? "server-online" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: ONE_MIN,
      refreshInterval: active ? ONE_MIN : 0,
    },
  );
  return { data: data ?? EMPTY, isLoading };
}
