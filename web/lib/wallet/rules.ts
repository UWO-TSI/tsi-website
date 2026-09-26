/**
 * Economy rules that don't need the database: the Toronto calendar day,
 * deterministic daily specials, effective prices and sell prices.
 * Never format a coin or Gem amount as money: no currency conversion exists.
 */
import { ROSTER } from "@/lib/collections/roster";
import { FISH } from "@/lib/game/fishing";
import { fnv1a, seededRandom } from "@/lib/game/weatherSystem";
import { torontoParts } from "@/lib/time";
import { CATALOGUE, OWNERSHIP_ITEMS, onSale, SELL_PRICES, SETTINGS, type ShopCategory, type Slot, type Tier } from "./catalogue";
import type { InventoryRow } from "./store";

export interface ShopItem {
  id: string;
  slug: string;
  display_name: string;
  category: ShopCategory | string;
  description: string;
  price_coins: number | null;
  price_gems: number | null;
  tier: Tier | null;
  slot: Slot | null;
  special_pool: boolean;
  stackable: boolean;
  stock: number | null;
  catalogue_ref: string | null;
  sprite_url: string | null;
  position: number;
  active: boolean;
  available_from: string | null;
  available_until: string | null;
}

/** YYYY-MM-DD in America/Toronto. */
export function torontoDay(now: Date): string {
  return torontoParts(now).date;
}

export function isOnSale(item: ShopItem, now: Date): boolean {
  if (!item.active) return false;
  if (item.available_from && now < new Date(item.available_from)) return false;
  if (item.available_until && now > new Date(item.available_until)) return false;
  return true;
}

export interface Special {
  item_id: string;
  slug: string;
  price_coins: number;
}

/**
 * Today's specials: the same `count` items for everyone all Toronto day,
 * picked from the coin-priced special pool by a seeded shuffle of the date.
 */
export function dailySpecials(items: ShopItem[], day: string, count: number = SETTINGS.special_count, pct: number = SETTINGS.special_discount_pct): Special[] {
  const pool = items.filter((i) => i.special_pool && i.active && i.price_coins !== null).sort((a, b) => a.slug.localeCompare(b.slug));
  const r = seededRandom(fnv1a(`specials:${day}`));
  const picked = [...pool];
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.slice(0, count).map((i) => ({ item_id: i.id, slug: i.slug, price_coins: Math.floor((i.price_coins! * (100 - pct)) / 100) }));
}

export function effectivePrice(item: ShopItem, specials: Special[]): { currency: "coins" | "gems"; price: number; special: boolean } {
  if (item.price_coins !== null) {
    const s = specials.find((x) => x.item_id === item.id);
    return { currency: "coins", price: s ? s.price_coins : item.price_coins, special: !!s };
  }
  return { currency: "gems", price: item.price_gems ?? 0, special: false };
}

const FISH_RARITY = new Map(FISH.map((f) => [f.key, f.rarity as string]));

/** Category + rarity for a collection key: the roster first, then the game's fish table. */
export function speciesClass(itemKey: string, fishRarity: (key: string) => string | null = (k) => FISH_RARITY.get(k) ?? null): { category: string; rarity: string } | null {
  const sp = ROSTER.find((s) => s.key === itemKey);
  if (sp) return { category: sp.category, rarity: sp.rarity };
  const r = fishRarity(itemKey);
  if (!r) return null;
  return { category: "fish", rarity: r === "seaking" ? "legendary" : r };
}

export function sellPrice(category: string, rarity: string, table: Record<string, Record<string, number>> = SELL_PRICES): number | null {
  return table[category]?.[rarity] ?? null;
}

/** Catalogue rows as the memory store / previews see them (033's seed, then the ownership migration's). */
export function seedItems(): ShopItem[] {
  return [...CATALOGUE, ...OWNERSHIP_ITEMS].map((c, i) => ({
    ...c,
    id: `00000000-0000-4000-8000-0000000e${String(i + 1).padStart(4, "0")}`,
    active: onSale(c),
    available_from: null,
    available_until: null,
  }));
}

/** What inventory rows unlock, by catalogue_ref (character part, `hair:<i>`, homes piece, finish) → quantity. */
export function ownedCounts(rows: InventoryRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) if (r.item.catalogue_ref) out.set(r.item.catalogue_ref, (out.get(r.item.catalogue_ref) ?? 0) + r.qty);
  return out;
}

export const TAB_OF: Record<string, "tools" | "outfits" | "furniture" | "merch"> = {
  tool: "tools", outfit: "outfits", hair: "outfits", accessory: "outfits", "avatar-outfit": "outfits", "avatar-effect": "outfits",
  furniture: "furniture", wallpaper: "furniture", flooring: "furniture", merch: "merch", "profile-customization": "outfits",
};
