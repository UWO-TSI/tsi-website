"use client";
import useSWR from "swr";
import { EMPTY_PRESENCE, fetchServerPresence, type OnlineData } from "./serverPresence";
export type { OnlinePlayer, OnlineNPC, UpcomingEvent } from "./serverPresence";

const ONE_MIN = 60_000;

/** The hold-Tab view polls recent heartbeats only while open. */
export function useServerOnline(active: boolean) {
  const { data, error, isLoading } = useSWR<OnlineData>(
    active ? "server-online" : null,
    () => fetchServerPresence(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: ONE_MIN,
      refreshInterval: active ? ONE_MIN : 0,
    },
  );
  return { data: data ?? EMPTY_PRESENCE, error, isLoading };
}
