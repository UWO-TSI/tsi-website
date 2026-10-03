/** The member marketplace's reads (marketplace_items / marketplace_orders, 001_initial_schema). */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeTone } from "@/components/gui";

export interface MarketItem {
  id: string;
  name: string;
  description: string | null;
  price_tc: number;
  category: string;
  stock: number;
  image_url: string | null;
  status: string;
}

export interface MarketOrder {
  id: string;
  item_id: string;
  quantity: number;
  total_tc: number;
  status: "pending_pickup" | "fulfilled" | "cancelled";
  created_at: string;
  item: { name: string; category: string } | null;
}

/** Your Gems, the items on sale and your orders; null signed out. A failed read throws (it isn't an empty shop). */
export async function loadMarketplace(db: SupabaseClient): Promise<{ balance: number; items: MarketItem[]; orders: MarketOrder[] } | null> {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const [profile, items, orders] = await Promise.all([
    db.from("profiles").select("tethos_coins").eq("id", user.id).single(),
    db.from("marketplace_items").select("id, name, description, price_tc, category, stock, image_url, status").eq("status", "available").order("name"),
    db.from("marketplace_orders")
      .select("id, item_id, quantity, total_tc, status, created_at, item:marketplace_items(name, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const error = profile.error ?? items.error ?? orders.error;
  if (error) throw new Error(error.message);
  return { balance: profile.data?.tethos_coins ?? 0, items: (items.data ?? []) as MarketItem[], orders: (orders.data ?? []) as unknown as MarketOrder[] };
}

/** Order status tags (the stored statuses): handed over is done, waiting for pickup is waiting. */
export const ORDER_TONES: Record<MarketOrder["status"], BadgeTone> = { fulfilled: "success", pending_pickup: "warn", cancelled: "neutral" };

export const canAfford = (balance: number, item: Pick<MarketItem, "price_tc">) => balance >= item.price_tc;

/** Your balance after a purchase: the one /api/economy answers with, else what it was (the page reloads it). */
export const balanceAfterPurchase = (body: unknown, before: number): number => {
  const balance = (body as { balance?: unknown } | null)?.balance;
  return typeof balance === "number" && Number.isFinite(balance) ? balance : before;
};
