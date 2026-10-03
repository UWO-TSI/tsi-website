/**
 * The admin shop list's own read of shop_items (T1/T2 read every row, 014): retired items too, and the coin price
 * (price_coins, 20260926150600). The member loader (useShopItems) shows only what's on sale, priced in Gems.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopItem } from "./types";

export type AdminShopItem = Omit<ShopItem, "tc_price"> & { tc_price: number | null; price_coins: number | null; position: number };

export async function loadAdminShopItems(db: SupabaseClient): Promise<AdminShopItem[]> {
  const { data, error } = await db
    .from("shop_items")
    .select("id, slug, display_name, category, sprite_url, description, tc_price, price_coins, rarity, stock, active, released_at, retired_at, position")
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AdminShopItem[];
}

/** Each item has exactly one price (shop_items_one_price): coins, or Gems. */
export const shopPrice = (item: Pick<AdminShopItem, "tc_price" | "price_coins">): { n: number; currency: "coins" | "gems" } | null =>
  typeof item.price_coins === "number" ? { n: item.price_coins, currency: "coins" }
    : typeof item.tc_price === "number" ? { n: item.tc_price, currency: "gems" }
    : null;
