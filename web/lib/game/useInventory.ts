"use client";

import useSWR from "swr";
import { createClient } from "@/lib/supabase/client";

export interface InventoryRow {
  id: string;
  item_id: string;
  acquired_at: string;
  source: "purchase" | "grant" | "earned" | "starter";
  equipped: boolean;
}

const FIVE_MIN = 5 * 60_000;

async function fetchInventory(userId: string | null): Promise<InventoryRow[]> {
  if (!userId) return [];
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("player_inventory")
      .select("id, item_id, acquired_at, source, equipped")
      .eq("user_id", userId)
      .order("acquired_at", { ascending: false });
    if (error || !data) return [];
    return data as InventoryRow[];
  } catch {
    return [];
  }
}

/**
 * Returns the current user's inventory (rows of shop_items they own).
 * SWR cache lives 5 min. Refreshes when items get bought via API.
 */
export function useInventory(userId: string | null) {
  const { data, isLoading, mutate } = useSWR<InventoryRow[]>(
    userId ? `inventory:${userId}` : null,
    () => fetchInventory(userId),
    { revalidateOnFocus: false, dedupingInterval: FIVE_MIN },
  );
  return {
    items: data ?? [],
    isLoading,
    refresh: mutate,
    owns: (itemId: string) => (data ?? []).some((r) => r.item_id === itemId),
  };
}
