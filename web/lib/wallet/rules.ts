/**
 * Economy rules that don't need the database: the Toronto calendar day,
 * deterministic daily specials, effective prices and sell prices.
 * Never format a coin or Gem amount as money: no currency conversion exists.
 */
import { ROSTER } from "@/lib/collections/roster";
import { FISH } from "@/lib/game/fishing";
import { fnv1a, seededRandom } from "@/lib/game/weatherSystem";
import { torontoParts } from "@/lib/time";
import { fishOutToday } from "@/lib/game/peaceful";
import type { WaterType } from "@/lib/game/fishingSpots";
import { CATALOGUE, EVENT_ITEMS, FISH_CHEF_PAY, FISH_TASK_PAY, FISH_TASK_VARIETY, STAFF_MEAL, type MealBuff, OWNERSHIP_ITEMS, onSale, SELL_PRICES, SETTINGS, type ShopCategory, type Slot, type Tier } from "./catalogue";
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
  return { category: "fish", rarity: r };
}

export function sellPrice(category: string, rarity: string, table: Record<string, Record<string, number>> = SELL_PRICES): number | null {
  return table[category]?.[rarity] ?? null;
}

export interface FishRequest {
  item_key: string;
  name: string;
  rarity: string;
  /** Coins it pays: FISH_TASK_PAY (a task) or FISH_CHEF_PAY (the chef) times its sell price. */
  reward: number;
}
/**
 * A fishing task (David, 2026-10-28: "its not a hand one over, its if you did it you claim it"): catch a fish, or
 * `need` different fish, within its Toronto day or week; done is checked on the server against your landed catches
 * (fishing_task_claim), and you claim the coins. `id`: `catch:<item_key>` or `variety:<need>`, unique in its period.
 */
export interface FishingTask {
  id: string;
  period: "day" | "week";
  /** The fish to catch; null for the variety task. */
  item_key: string | null;
  name: string;
  rarity: string | null;
  need: number;
  reward: number;
}
const DAILY_RARITIES = ["common", "uncommon", "rare"];
/**
 * The fishing tasks for a Toronto day (the same for everyone): three a day, one common, one uncommon and one rare (or the
 * nearest left), each a fish that bites that day in fair weather in `waters`, the waters the world has; and two a week
 * (from its Monday, `week`): one rare or epic fish biting that month, and FISH_TASK_VARIETY.need different fish.
 */
export function fishingTasks(day: string, week: string, waters: readonly WaterType[]): { day: FishingTask[]; week: FishingTask[] } {
  const pool = requestable(day, waters, DAILY_RARITIES, FISH_TASK_PAY);
  const r = seededRandom(fnv1a(`fish-requests:${day}`)), daily: FishRequest[] = [];
  for (const rarity of DAILY_RARITIES) {
    const left = pool.filter((f) => !daily.includes(f)), same = left.filter((f) => f.rarity === rarity), from = same.length ? same : left;
    if (from.length) daily.push(from[Math.floor(r() * from.length)]);
  }
  const big = requestable(week, waters, ["rare", "epic"], FISH_TASK_PAY * 2);
  const weekly = big.length ? [big[Math.floor(seededRandom(fnv1a(`fish-task-week:${week}`))() * big.length)]] : [];
  const task = (period: FishingTask["period"]) => (f: FishRequest): FishingTask => ({ id: `catch:${f.item_key}`, period, item_key: f.item_key, name: f.name, rarity: f.rarity, need: 1, reward: f.reward });
  return {
    day: daily.map(task("day")),
    week: [...weekly.map(task("week")), { id: `variety:${FISH_TASK_VARIETY.need}`, period: "week", item_key: null, name: "Different fish", rarity: null, ...FISH_TASK_VARIETY }],
  };
}

/** The fish of these rarities biting that day in `waters`, paying `pay` times their price, in key order. */
function requestable(day: string, waters: readonly WaterType[], rarities: readonly string[], pay: number): FishRequest[] {
  return fishOutToday(waters, Number(day.slice(5, 7))).flatMap(({ fish }) => {
    const cls = speciesClass(fish.key), price = cls && speciesSellPrice(fish.key);
    return cls && price && rarities.includes(cls.rarity) ? [{ item_key: fish.key, name: fish.name, rarity: cls.rarity, reward: price * pay }] : [];
  }).sort((a, b) => a.item_key.localeCompare(b.item_key));
}
/**
 * The sushi chef's order for a Toronto day (f-sushi, David: "chef will give orders for you to fish"): one rare or epic
 * fish none of the day's tasks asks for, handed over for FISH_CHEF_PAY times its price and a staff meal. Null when none bites.
 */
export function chefOrder(day: string, waters: readonly WaterType[]): (FishRequest & { meal: MealBuff }) | null {
  const asked = new Set(fishingTasks(day, day, waters).day.map((f) => f.item_key));
  const pool = requestable(day, waters, ["rare", "epic"], FISH_CHEF_PAY).filter((f) => !asked.has(f.item_key));
  return pool.length ? { ...pool[Math.floor(seededRandom(fnv1a(`chef-order:${day}`))() * pool.length)], meal: STAFF_MEAL } : null;
}

/** What one of this item sells for: its roster price when set, else its category and rarity's (economy_sell, 20261027180000_species_sell_price.sql). */
export function speciesSellPrice(itemKey: string): number | null {
  const cls = speciesClass(itemKey);
  return cls ? (ROSTER.find((s) => s.key === itemKey)?.price ?? sellPrice(cls.category, cls.rarity)) : null;
}

/** Catalogue rows as the memory store / previews see them (033's seed, then the ownership migration's). */
export function seedItems(): ShopItem[] {
  return [...CATALOGUE, ...OWNERSHIP_ITEMS, ...EVENT_ITEMS].map((c, i) => ({
    ...c,
    id: `00000000-0000-4000-8000-0000000e${String(i + 1).padStart(4, "0")}`,
    active: onSale(c) && !EVENT_ITEMS.includes(c),
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
  tool: "tools", outfit: "outfits", hair: "outfits", accessory: "outfits", face: "outfits", "avatar-outfit": "outfits", "avatar-effect": "outfits",
  furniture: "furniture", wallpaper: "furniture", flooring: "furniture", merch: "merch", "profile-customization": "outfits",
};
