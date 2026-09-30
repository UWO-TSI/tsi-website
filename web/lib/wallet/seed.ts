/** SQL seeds for the economy catalogue (kept verbatim in 20260926150600_economy.sql and 20260926180000_ownership.sql). */
import { CATALOGUE, EVENT_ITEMS, onSale, OWNERSHIP_ITEMS, RETIRED, SELL_PRICES, SETTINGS, STARTER_REFS, type CatalogueEntry } from "./catalogue";
import { n, q } from "@/lib/collections/seed";

const b = (v: boolean) => (v ? "TRUE" : "FALSE");
const cols = (c: CatalogueEntry) => [q(c.slug), q(c.display_name), q(c.category), q(c.description), n(c.price_coins), n(c.price_gems), q(c.tier), q(c.slot), b(c.special_pool), b(c.stackable), n(c.stock), q(c.catalogue_ref), n(c.position)];
const ITEM_COLS = "slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position";
export const SEED_BEGIN = "-- BEGIN GENERATED ECONOMY SEED (web/scripts/gen-seeds.mjs)";
export const SEED_END = "-- END GENERATED ECONOMY SEED";
export const OWNERSHIP_BEGIN = "-- BEGIN GENERATED OWNERSHIP SEED (web/scripts/gen-seeds.mjs)";
export const OWNERSHIP_END = "-- END GENERATED OWNERSHIP SEED";

export function economySeedSql(): string {
  const items = CATALOGUE.map((c) => `  (${cols(c).join(", ")})`);
  const prices = Object.entries(SELL_PRICES).flatMap(([cat, byRarity]) => Object.entries(byRarity).map(([r, p]) => `  ('${cat}', '${r}', ${p})`));
  // Only the settings SQL reads; today's specials are picked in TS (rules.ts dailySpecials).
  const settings = Object.entries(SETTINGS).filter(([k]) => !k.startsWith("special_")).map(([k, v]) => `  ('${k}', ${v})`);
  return [
    SEED_BEGIN,
    `INSERT INTO shop_items (${ITEM_COLS}) VALUES`,
    items.join(",\n"),
    "ON CONFLICT (slug) DO NOTHING;",
    "INSERT INTO sell_prices (category, rarity, price) VALUES",
    prices.join(",\n"),
    "ON CONFLICT (category, rarity) DO NOTHING;",
    "INSERT INTO economy_settings (key, value) VALUES",
    settings.join(",\n"),
    "ON CONFLICT (key) DO NOTHING;",
    SEED_END,
  ].join("\n");
}

/** New wearables, dyes and homes pieces; the retired rows off sale; which rows are starters. */
export function ownershipSeedSql(): string {
  const starters = [...CATALOGUE, ...OWNERSHIP_ITEMS].filter((c) => c.catalogue_ref !== null && STARTER_REFS.has(c.catalogue_ref));
  return [
    OWNERSHIP_BEGIN,
    `INSERT INTO shop_items (${ITEM_COLS}, active) VALUES`,
    OWNERSHIP_ITEMS.map((c) => `  (${[...cols(c), b(onSale(c))].join(", ")})`).join(",\n"),
    "ON CONFLICT (slug) DO NOTHING;",
    `UPDATE shop_items SET active = FALSE WHERE slug IN (${RETIRED.map(q).join(", ")});`,
    "UPDATE shop_items s SET starter_qty = v.qty FROM (VALUES",
    starters.map((c) => `  (${q(c.slug)}, ${STARTER_REFS.get(c.catalogue_ref!)})`).join(",\n"),
    ") AS v (slug, qty) WHERE s.slug = v.slug;",
    OWNERSHIP_END,
  ].join("\n");
}

export const EVENT_BEGIN = "-- BEGIN GENERATED EVENT FURNITURE (web/scripts/gen-seeds.mjs)";
export const EVENT_END = "-- END GENERATED EVENT FURNITURE";

/** Seasonal event furniture: off sale, granted by the event goal. */
export function eventItemsSeedSql(): string {
  return [
    EVENT_BEGIN,
    `INSERT INTO shop_items (${ITEM_COLS}, active) VALUES`,
    EVENT_ITEMS.map((c) => `  (${[...cols(c), "FALSE"].join(", ")})`).join(",\n"),
    "ON CONFLICT (slug) DO NOTHING;",
    EVENT_END,
  ].join("\n");
}
