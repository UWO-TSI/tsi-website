"use client";

import useSWR from "swr";

export interface GhostPosition {
  user_id: string;
  world_x: number;
  world_z: number;
  recorded_at: string;
  display_name: string;
  level: number;
}

const FIVE_MIN = 5 * 60_000;

async function fetchGhosts(): Promise<GhostPosition[]> {
  try {
    const res = await fetch("/api/positions/ghosts");
    if (!res.ok) return [];
    const data = await res.json();
    return data.ghosts ?? [];
  } catch {
    return [];
  }
}

export function useGhostPositions() {
  const { data, error, isLoading } = useSWR<GhostPosition[]>(
    "ghost-positions",
    fetchGhosts,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: FIVE_MIN,
      refreshInterval: FIVE_MIN,
    },
  );
  return { ghosts: data ?? [], isLoading, error };
}
