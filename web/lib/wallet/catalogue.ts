/**
 * Shop catalogue seed (rows 94, 127, 186): tools in basic/mid tiers, outfits,
 * hair recolours, accessories, furniture and finishes from the homes
 * catalogue, and the TSI merch corner in Gems. Seeded from here
 * (lib/seedMigrations.ts, scripts/gen-seeds.mjs). Prices are play coins
 * (or Gems for merch). No real-money value appears anywhere.
 */
import { dyeRef, FREE_HAIR_COLOURS, PARTS, STARTER_PARTS, type PartSlot } from "@/lib/game/character/look";
import { CATALOGUE as PIECES, EVENT_PIECE_IDS } from "@/lib/homes/catalogue";
import { shopIcon } from "@/lib/icons/keys";

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
/** Every row's sprite_url is its rendered icon (row 281, lib/icons). */
export const withIcon = (c: CatalogueEntry): CatalogueEntry => ({ ...c, sprite_url: shopIcon(c) });
const e = (slug: string, display_name: string, category: ShopCategory, price: number, x: Partial<CatalogueEntry> = {}): CatalogueEntry => withIcon({
  slug, display_name, category, description: "", price_coins: price, price_gems: null, tier: null, slot: null,
  special_pool: false, stackable: false, stock: null, catalogue_ref: null, sprite_url: null, position: ++pos, ...x,
});
const furniture = (ref: string, name: string, price: number) => e(`furn-${ref}`, name, "furniture", price, { catalogue_ref: ref, stackable: true, special_pool: true });

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
  // The backpack's first upgrade (specs/game-ui-questions.md 23): bought here or crafted (starter recipe). The next is crafted only (lib/crafting/recipes.ts).
  e("bag-30", "Roomier pocket", "tool", 1500, { catalogue_ref: "bag:30", description: "Your backpack holds 30 things instead of 20." }),
];

/**
 * Club merch waiting on its migration (specs/merch/tsi-keycap-keychain.md, David 2026-10-17): it joins CATALOGUE when
 * its seed migration is written. Held back for now: adding a row to CATALOGUE regenerates the economy and shop-icons
 * seeds, and game/wardrobe-b2's unmerged 20261017172740 regenerates shop-icons too (the coordinator decides the order).
 * The models, the shop's display and the dev economy read it from here meanwhile.
 */
export const PENDING_MERCH: CatalogueEntry[] = [
  withIcon({ slug: "merch-tsi-keycap-keychain", display_name: "TSI keycap keychain", category: "merch",
    description: "A Gateron Milky Yellow Pro switch in clear acrylic, under a navy TSI keycap with the Tethos mark. Press it: it clicks. Pick up at HQ on campus.",
    price_coins: null, price_gems: 500, tier: null, slot: null, special_pool: false, stackable: false, stock: null, catalogue_ref: null, sprite_url: null, position: 38 }),
  // specs/merch/tsi-lanyard.md: no price yet (David sets it), so off sale; the shop shows it with "Price to come".
  withIcon({ slug: "merch-tsi-lanyard", display_name: "TSI lanyard", category: "merch",
    description: "Navy, printed both sides: GENESIS and TETHOS with the Tethos mark outside, the Steve Jobs quote inside. Silver D-ring and swivel snap hook. Pick up at HQ on campus.",
    price_coins: null, price_gems: null, tier: null, slot: null, special_pool: false, stackable: false, stock: null, catalogue_ref: null, sprite_url: null, position: 39 }),
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
const pieceValue = (p: (typeof PIECES)[number]) => 60 + (p.mount === "rug" ? 15 : 40) * p.size[0] * p.size[1];
pos = 199;

/**
 * Wearables David's wardrobe cut took out of the character catalogue (playtest round 1, row 309). Their shop rows stay
 * where they were (`after`: the part they follow), retired: off sale, never a special, granted to no one. Owners keep
 * their inventory rows; a saved look wearing one loads with that slot's default (parseLook).
 */
const CUT_WEARABLES: { id: string; name: string; slot: PartSlot; after: string }[] = [
  { id: "onepiece_raincape", name: "Hooded rain-cape dress", slot: "onepiece", after: "bottom_long_skirt" },
  { id: "onepiece_robe", name: "Robe", slot: "onepiece", after: "onepiece_sundress" },
  { id: "onepiece_jumpsuit", name: "Jumpsuit", slot: "onepiece", after: "onepiece_robe" },
  { id: "acc_beanie", name: "Beanie", slot: "accessory", after: "acc_glasses_square" },
  { id: "acc_scarf", name: "Scarf", slot: "accessory", after: "acc_shoulder_bag" },
];
const wearSlug = (id: string) => `wear-${id.replace(/_/g, "-")}`;
const WEARABLES: { id: string; name: string; slot: PartSlot; cut?: boolean }[] =
  PARTS.filter((p) => p.slot !== "bangs" && p.slot !== "back" && !p.variantOf && !p.item && !p.event).map((p) => ({ id: p.id, name: p.name, slot: p.slot }));
for (const c of CUT_WEARABLES) WEARABLES.splice(WEARABLES.findIndex((w) => w.id === c.after) + 1, 0, { ...c, cut: true });

/**
 * Rows the ownership migration adds: every wearable part, the dyes, the homes pieces the shop lacked. Starter clothes are never sold.
 * Parts with an `item` are unlocked by that existing (crafted) item instead, so they get no shop row; event costumes (`event`)
 * are free while their tradition runs, never sold. The wardrobe cut's rows stay, retired (CUT_WEARABLES).
 */
export const OWNERSHIP_ITEMS: CatalogueEntry[] = [
  ...WEARABLES.map((p) =>
    e(wearSlug(p.id), p.name.replace(/ \(#\d+\)$/, ""), p.slot === "accessory" ? "accessory" : "outfit", WEAR_PRICE[p.slot], { catalogue_ref: p.id, special_pool: !p.cut && !STARTER_REFS.has(p.id) })),
  ...DYES.map((name, i) => e(`dye-${name.toLowerCase().replace(/ /g, "-")}`, `${name} hair dye`, "hair", 140, { catalogue_ref: dyeRef(FREE_HAIR_COLOURS + i), special_pool: true })),
  ...PIECES.filter((p) => !HAS_FURNITURE.has(p.id) && !EVENT_PIECE_IDS.has(p.id)).map((p) => furniture(p.id, p.label, pieceValue(p))),
];
/**
 * The tier-1 bug net and shovel: a resident hands them over (row 312, lib/game/arrival/hq/teachers.ts; David
 * 2026-10-17, "take them off sale"). Off sale; owners keep them, and the better tiers stay on the shelf.
 */
export const TAUGHT_TOOL_SLUGS = ["net-basic", "shovel-basic"];
/** Shop rows with no character part: the pre-ownership outfits, the wardrobe cut's (CUT_WEARABLES), and the taught tools. Off sale. */
export const RETIRED = ["outfit-sage-overalls", "outfit-cream-knit", "outfit-wharf-raincoat", "outfit-club-tee", "hair-chestnut", "hair-sea-glass", "hair-sunset", "acc-straw-hat", "acc-round-glasses", "acc-bandana",
  ...CUT_WEARABLES.map((c) => wearSlug(c.id)), ...TAUGHT_TOOL_SLUGS];
/** Sold, as opposed to only granted: starter clothes stay off sale. */
export const onSale = (c: CatalogueEntry) => !RETIRED.includes(c.slug) && !(c.category !== "furniture" && c.catalogue_ref !== null && STARTER_REFS.has(c.catalogue_ref));

/**
 * Seasonal event furniture (20260929120000_seasonal_events.sql): seeded off
 * sale and given to every member by the event goal's completion; `price_coins`
 * is only the catalogue's nominal value.
 */
export const EVENT_ITEMS: CatalogueEntry[] = PIECES.filter((p) => EVENT_PIECE_IDS.has(p.id)).map((p) => ({ ...furniture(p.id, p.label, pieceValue(p)), special_pool: false }));

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
