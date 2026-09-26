/** SQL seed for the economy catalogue, sell prices and settings (kept verbatim in 20260926150600_economy.sql). */
import { CATALOGUE, SELL_PRICES, SETTINGS } from "./catalogue";

const q = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v === null ? "NULL" : String(v));
export const SEED_BEGIN = "-- BEGIN GENERATED ECONOMY SEED (web/scripts/gen-seeds.mjs)";
export const SEED_END = "-- END GENERATED ECONOMY SEED";

export function economySeedSql(): string {
  const items = CATALOGUE.map((c) => `  (${[q(c.slug), q(c.display_name), q(c.category), q(c.description), n(c.price_coins), n(c.price_gems), q(c.tier), q(c.slot), c.special_pool ? "TRUE" : "FALSE", c.stackable ? "TRUE" : "FALSE", n(c.stock), q(c.catalogue_ref), n(c.position)].join(", ")})`);
  const prices = Object.entries(SELL_PRICES).flatMap(([cat, byRarity]) => Object.entries(byRarity).map(([r, p]) => `  ('${cat}', '${r}', ${p})`));
  // Only the settings SQL reads; today's specials are picked in TS (rules.ts dailySpecials).
  const settings = Object.entries(SETTINGS).filter(([k]) => !k.startsWith("special_")).map(([k, v]) => `  ('${k}', ${v})`);
  return [
    SEED_BEGIN,
    "INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position) VALUES",
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
