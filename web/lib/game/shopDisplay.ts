/**
 * What the shop shows on its fixtures (specs/interiors/shop.md, phase 2): each display slot's item from the catalogue,
 * with the name and mini image its proximity tag shows and the model it's shown as (the same model and tints as its
 * icon, lib/icons/manifest.ts). The front plinths carry today's specials (the shop's own daily picks, rules.ts
 * dailySpecials) until there's seasonal stock; everything else is a fixed pick from what's on sale.
 */
import { CATALOGUE, OWNERSHIP_ITEMS, onSale, type CatalogueEntry } from "@/lib/wallet/catalogue";
import { HOME_CATEGORIES, dailySpecials, torontoDay, type ShopItem } from "@/lib/wallet/rules";
import { DROPS } from "./drops";
import { iconKey, iconUrl, type IconSpec } from "@/lib/icons/manifest";
import { itemSpec } from "@/lib/icons/itemModel";
import { SHOP_SLOTS, SHOP_TAG_RANGE, type Level } from "./shopLayout";

/** Every slot but the front plinths': the catalogue row it shows (slug). */
export const SHOP_PICKS: Record<string, string> = {
  "clothes-1": "wear-top-cardigan", "clothes-2": "wear-top-collar-shirt", "clothes-3": "wear-top-tsi-crew",
  "clothes-4": "wear-shoes-loafers", "clothes-5": "wear-shoes-boots", "clothes-6": "wear-shoes-sandals",
  "tools-1": "rod-cedar", "tools-2": "rod-glass", "tools-3": "bobber-lucky", "tools-4": "bait-sweet",
  "dyes-1": "dye-wheat-blonde", "dyes-2": "dye-copper", "dyes-3": "dye-rust-red", "dyes-4": "dye-silver", "dyes-5": "dye-blossom-pink", "dyes-6": "dye-sea-blue",
  "accessories-1": "wear-acc-glasses-round", "accessories-2": "wear-acc-sunhat", "accessories-3": "wear-acc-cap", "accessories-4": "wear-acc-visor",
  "furniture-1": "furn-lounge-sofa", "furniture-2": "furn-floor-lamp", "furniture-3": "furn-study-chair",
  "wallpaper-1": "wall-stripe", "wallpaper-2": "wall-log", "wallpaper-3": "wall-brick",
  "flooring-1": "floor-tatami", "flooring-2": "floor-carpet", "flooring-3": "floor-plain",
  // The club merch upstairs is only the three real items (specs/merch/; David, 2026-10-22, the placeholder tote and
  // sticker pack off sale): the slots that held those show more of the three.
  "merch-bags-1": "merch-tsi-keycap-keychain", "merch-bags-2": "merch-tsi-lanyard",
  "merch-small-1": "merch-genesis-sticker", "merch-small-2": "merch-tsi-keycap-keychain", "merch-small-3": "merch-genesis-sticker",
  "merch-small-4": "merch-tsi-keycap-keychain", "merch-small-5": "merch-genesis-sticker",
  "merch-featured-1": "merch-tsi-lanyard", "merch-featured-2": "merch-genesis-sticker",
  "merch-keychain-1": "merch-tsi-keycap-keychain",
  "merch-lanyard-1": "merch-tsi-lanyard",
  "merch-sticker-1": "merch-genesis-sticker",
};
/** The front plinths: today's specials, in order. */
export const SPECIALS_SLOTS = ["seasonal-1", "seasonal-2", "seasonal-3"] as const;

export interface ShopDisplayItem {
  slot: string;
  slug: string;
  /** The tag's line. */
  name: string;
  /** The tag's mini image. */
  icon: string;
  /** What to show it as: the icon's model (or a finish's texture). */
  spec: IconSpec;
  /** One of today's specials (the front plinths). */
  special: boolean;
}

const ON_SALE: readonly CatalogueEntry[] = [...CATALOGUE, ...OWNERSHIP_ITEMS].filter(onSale);
const BY_SLUG = new Map(ON_SALE.map(e => [e.slug, e]));
const PLINTH_FILL = ON_SALE.filter(e => e.special_pool && (DROPS.homeIsland || !HOME_CATEGORIES.has(e.category)) && itemSpec(e));

/** Today's specials as the shop picks them (the same shuffle the server runs on the same rows). */
export function todaysSpecials(day: string): CatalogueEntry[] {
  const rows = ON_SALE.map(e => ({ ...e, id: e.slug, active: true, sprite_url: e.sprite_url, available_from: null, available_until: null }) as unknown as ShopItem);
  return dailySpecials(rows, day).map(s => BY_SLUG.get(s.slug)!).filter(Boolean);
}

/** Every display slot's item today (a slot with nothing to show is left out). */
export function shopDisplay(now: Date = new Date()): ShopDisplayItem[] {
  // The plinths show today's specials that have a model, then fill up from the rest of the pool that does (a hairstyle
  // has no model to stand on a plinth; home things wait for homes, lib/wallet/rules.ts).
  const today = todaysSpecials(torontoDay(now)).filter(e => itemSpec(e));
  const specials = [...today, ...PLINTH_FILL.filter(e => !today.includes(e))];
  const out: ShopDisplayItem[] = [];
  for (const s of SHOP_SLOTS) {
    const i = (SPECIALS_SLOTS as readonly string[]).indexOf(s.id);
    const entry = i >= 0 ? specials[i] : BY_SLUG.get(SHOP_PICKS[s.id] ?? "");
    const spec = entry && itemSpec(entry);
    if (!entry || !spec) continue;
    out.push({ slot: s.id, slug: entry.slug, name: entry.display_name, icon: iconUrl(iconKey(entry)), spec, special: i >= 0 && today.includes(entry) });
  }
  return out;
}

const SLOT_AT = new Map(SHOP_SLOTS.map(s => [s.id, s]));
/**
 * The item a tag shows: the nearest on show on your floor (null on the stair) within `range`, by the distance across
 * the floor to the middle of its slot.
 */
export function nearestDisplay(items: readonly ShopDisplayItem[], x: number, z: number, level: Level | null, range = SHOP_TAG_RANGE): ShopDisplayItem | null {
  if (level === null) return null;
  let best: ShopDisplayItem | null = null, bestD = range;
  for (const item of items) {
    const s = SLOT_AT.get(item.slot);
    if (!s || s.level !== level) continue;
    const d = Math.hypot(s.at[0] - x, s.at[2] - z);
    if (d < bestD) { bestD = d; best = item; }
  }
  return best;
}
