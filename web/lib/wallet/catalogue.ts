/**
 * Shop catalogue seed (rows 94, 127, 186): tools in basic/mid tiers, outfits,
 * hair recolours, accessories, furniture and finishes from the homes
 * catalogue, and the TSI merch corner in Gems. Mirrored into
 * 20260926150600_economy.sql by scripts/gen-economy-seed.mjs. Prices are play coins
 * (or Gems for merch). No real-money value appears anywhere.
 */
export type ShopCategory = "tool" | "outfit" | "hair" | "accessory" | "furniture" | "wallpaper" | "flooring" | "merch";
export type Tier = "basic" | "mid" | "premium";
export type Slot = "rod" | "net" | "shovel" | "outfit" | "hair" | "accessory";

export interface CatalogueEntry {
  slug: string;
  display_name: string;
  category: ShopCategory;
  description: string;
  price_coins: number | null;
  price_gems: number | null;
  tier: Tier | null;
  slot: Slot | null;
  special_pool: boolean;
  stackable: boolean;
  stock: number | null;
  catalogue_ref: string | null; // homes piece id / wallpaper key / legacy gear key
  sprite_url: string | null;
  position: number;
}

let pos = 0;
const e = (slug: string, display_name: string, category: ShopCategory, price: number, x: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  slug, display_name, category, description: "", price_coins: price, price_gems: null, tier: null, slot: null,
  special_pool: false, stackable: false, stock: null, catalogue_ref: null, sprite_url: null, position: ++pos, ...x,
});
const furniture = (ref: string, name: string, price: number) => e(`furn-${ref}`, name, "furniture", price, { catalogue_ref: ref, stackable: true, special_pool: true, sprite_url: null });

export const CATALOGUE: CatalogueEntry[] = [
  // Tools (row 127: basic rod ~100, mid ~400)
  e("rod-basic", "Basic rod", "tool", 100, { tier: "basic", slot: "rod", description: "A sturdy starter rod." }),
  e("rod-cedar", "Cedar rod", "tool", 400, { tier: "mid", slot: "rod", catalogue_ref: "rod_cedar", description: "Lighter, and a little lucky." }),
  e("rod-glass", "Glass rod", "tool", 1200, { tier: "premium", slot: "rod", catalogue_ref: "rod_glass", description: "The pier regulars' favourite." }),
  e("bobber-lucky", "Lucky bobber", "tool", 600, { tier: "premium", catalogue_ref: "bobber_lucky", description: "Tackle. Purely for luck." }),
  e("net-basic", "Bug net", "tool", 100, { tier: "basic", slot: "net" }),
  e("net-mid", "Wide net", "tool", 400, { tier: "mid", slot: "net" }),
  e("shovel-basic", "Shovel", "tool", 100, { tier: "basic", slot: "shovel" }),
  e("shovel-mid", "Iron shovel", "tool", 400, { tier: "mid", slot: "shovel" }),
  // Outfits (~150), hair recolours, accessories
  e("outfit-sage-overalls", "Sage overalls", "outfit", 150, { slot: "outfit", special_pool: true }),
  e("outfit-cream-knit", "Cream knit sweater", "outfit", 150, { slot: "outfit", special_pool: true }),
  e("outfit-wharf-raincoat", "Wharf raincoat", "outfit", 180, { slot: "outfit", special_pool: true }),
  e("outfit-club-tee", "Club tee", "outfit", 120, { slot: "outfit", special_pool: true }),
  e("hair-chestnut", "Chestnut hair dye", "hair", 120, { slot: "hair", special_pool: true }),
  e("hair-sea-glass", "Sea-glass hair dye", "hair", 140, { slot: "hair", special_pool: true }),
  e("hair-sunset", "Sunset hair dye", "hair", 140, { slot: "hair", special_pool: true }),
  e("acc-straw-hat", "Straw hat", "accessory", 80, { slot: "accessory", special_pool: true }),
  e("acc-round-glasses", "Round glasses", "accessory", 80, { slot: "accessory", special_pool: true }),
  e("acc-bandana", "Bandana", "accessory", 60, { slot: "accessory", special_pool: true }),
  // Furniture (homes catalogue pieces; stackable: you can own several)
  furniture("lounge-sofa", "Sofa", 300),
  furniture("study-desk", "Study desk", 250),
  furniture("study-chair", "Study chair", 120),
  furniture("bookshelf", "Bookshelf", 220),
  furniture("floor-lamp", "Floor lamp", 110),
  furniture("plant-monstera", "Monstera", 90),
  furniture("lounge-rug", "Cream rug", 140),
  furniture("wall-clock", "Wall clock", 80),
  furniture("wall-frame", "Picture frame", 60),
  furniture("bench-park", "Park bench", 180),
  furniture("streetlamp", "Street lamp", 160),
  furniture("campfire", "Campfire", 200),
  // Wallpaper and flooring (homes finishes)
  e("wall-stripe", "Striped wallpaper", "wallpaper", 100, { catalogue_ref: "stripe02" }),
  e("wall-log", "Log wallpaper", "wallpaper", 120, { catalogue_ref: "log00" }),
  e("wall-brick", "Brick wallpaper", "wallpaper", 120, { catalogue_ref: "brick00" }),
  e("floor-tatami", "Tatami flooring", "flooring", 100, { catalogue_ref: "tatami00" }),
  e("floor-carpet", "Soft carpet", "flooring", 100, { catalogue_ref: "simplecarpet01" }),
  e("floor-plain", "Plain boards", "flooring", 80, { catalogue_ref: "simple00" }),
  // TSI merch corner (Gems; campus pickup)
  e("merch-sticker-pack", "TSI sticker pack", "merch", 0, { price_coins: null, price_gems: 150, stock: 100, description: "Five die-cut stickers. Pick up at HQ on campus." }),
  e("merch-tote", "TSI tote bag", "merch", 0, { price_coins: null, price_gems: 600, stock: 30, description: "Canvas tote. Pick up at HQ on campus." }),
];

/** Sell prices by category and rarity (row 91), in play coins per item. */
export const SELL_PRICES: Record<string, Record<string, number>> = {
  fish: { common: 8, uncommon: 20, rare: 60, epic: 180, legendary: 600 },
  sea: { common: 8, uncommon: 20, rare: 60, epic: 180, legendary: 600 },
  bug: { common: 6, uncommon: 16, rare: 50, epic: 150, legendary: 500 },
  fruit: { common: 10, uncommon: 25, rare: 60, epic: 150, legendary: 400 },
  nature: { common: 4, uncommon: 12, rare: 40, epic: 120, legendary: 400 },
  mineral: { common: 5, uncommon: 15, rare: 45, epic: 135, legendary: 450 },
};

/** Daily gift (row 225): 10 coins, doubled on Fridays (Toronto day). */
export function dailyGiftAmount(day: string, base: number = SETTINGS.daily_gift_coins): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5 ? base * 2 : base;
}

export const SETTINGS = { daily_gift_coins: 10, event_attendance_coins: 50, special_count: 3, special_discount_pct: 20, max_open_merch: 3 } as const;
