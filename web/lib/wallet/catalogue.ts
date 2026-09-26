/**
 * Shop catalogue seed (rows 94, 127, 186): tools in basic/mid tiers, outfits,
 * hair recolours, accessories, furniture and finishes from the homes
 * catalogue, and the TSI merch corner in Gems. Mirrored into
 * 20260926150600_economy.sql by scripts/gen-seeds.mjs. Prices are play coins
 * (or Gems for merch). No real-money value appears anywhere.
 */
import { dyeRef, FREE_HAIR_COLOURS, PARTS, STARTER_PARTS } from "@/lib/game/character/look";
import { CATALOGUE as PIECES } from "@/lib/homes/catalogue";

export type ShopCategory ="tool" | "outfit" | "hair" | "accessory" | "furniture" | "wallpaper" | "flooring" | "merch";
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
  catalogue_ref: string | null; // homes piece id / wallpaper key / character part id / hair:<i> / legacy gear key
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
  e("acc-straw-hat", "Straw hat", "accessory", 80, { slot: "accessory", special_pool: true, catalogue_ref: "acc_straw_hat" }), // off sale; crafted (starter recipe)
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

// ── Ownership (coordinator ruling on audit item 22; 20260926180000_ownership.sql) ──
// Clothes are character parts (catalogue_ref = part id), dyes are `hair:<palette
// index>`, furniture is every homes piece. Mirrored by scripts/gen-seeds.mjs.

/** Starter home pieces (the starter room: bed, lamp, shelf, closet) plus the 10-piece pack, piece id → qty. */
export const STARTER_FURNITURE: Record<string, number> = {
  "home-bed": 1, "floor-lamp": 1, bookshelf: 1, closet: 1,
  "lounge-table": 1, "reading-table": 1, "study-chair": 1, "wooden-chest": 1, "plant-yucca": 1, candle: 1, "yellow-message-mat": 1, "wall-frame": 1, "bench-wood": 1, "flower-tulip": 1,
};
/** Everything granted once per account (economy_grant_starters), catalogue_ref → qty. */
export const STARTER_REFS: ReadonlyMap<string, number> = new Map([...STARTER_PARTS.map((id): [string, number] => [id, 1]), ...Object.entries(STARTER_FURNITURE)]);
/** Shop dyes for hair colours FREE_HAIR_COLOURS.. (palette order). */
const DYES = ["Wheat blonde", "Copper", "Rust red", "Silver", "Blossom pink", "Sea blue"];
const WEAR_PRICE: Record<string, number> = { top: 150, bottom: 140, onepiece: 180, shoes: 110, accessory: 80 };
const HAS_FURNITURE = new Set(CATALOGUE.map((c) => c.catalogue_ref));
pos = 199;

/**
 * Rows the ownership migration adds: every wearable part, the dyes, the homes pieces the shop lacked. Starter clothes are never sold.
 * Parts with an `item` are unlocked by that existing (crafted) item instead, so they get no shop row.
 */
export const OWNERSHIP_ITEMS: CatalogueEntry[] = [
  ...PARTS.filter((p) => p.slot !== "bangs" && p.slot !== "back" && !p.variantOf && !p.item).map((p) =>
    e(`wear-${p.id.replace(/_/g, "-")}`, p.name.replace(/ \(#\d+\)$/, ""), p.slot === "accessory" ? "accessory" : "outfit", WEAR_PRICE[p.slot], { catalogue_ref: p.id, special_pool: !STARTER_REFS.has(p.id) })),
  ...DYES.map((name, i) => e(`dye-${name.toLowerCase().replace(/ /g, "-")}`, `${name} hair dye`, "hair", 140, { catalogue_ref: dyeRef(FREE_HAIR_COLOURS + i), special_pool: true })),
  ...PIECES.filter((p) => !HAS_FURNITURE.has(p.id)).map((p) => furniture(p.id, p.label, 60 + (p.mount === "rug" ? 15 : 40) * p.size[0] * p.size[1])),
];
/** Pre-ownership outfit rows with no character part: off sale. */
export const RETIRED = ["outfit-sage-overalls", "outfit-cream-knit", "outfit-wharf-raincoat", "outfit-club-tee", "hair-chestnut", "hair-sea-glass", "hair-sunset", "acc-straw-hat", "acc-round-glasses", "acc-bandana"];
/** Sold, as opposed to only granted: starter clothes stay off sale. */
export const onSale = (c: CatalogueEntry) => !RETIRED.includes(c.slug) && !(c.category !== "furniture" && c.catalogue_ref !== null && STARTER_REFS.has(c.catalogue_ref));

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
