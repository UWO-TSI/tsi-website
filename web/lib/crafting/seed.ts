/** SQL seed for crafting (kept verbatim in 20260926160000_crafting.sql; regenerate with scripts/gen-crafting-seed.mjs). */
import { seedSql } from "@/lib/collections/seed";
import type { CatalogueEntry } from "@/lib/wallet/catalogue";
import { CRAFTED_ITEMS, MATERIALS, RECIPE_CARDS, RECIPES } from "./recipes";

const q = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v === null ? "NULL" : String(v));
export const SEED_BEGIN = "-- BEGIN GENERATED CRAFTING SEED (web/scripts/gen-crafting-seed.mjs)";
export const SEED_END = "-- END GENERATED CRAFTING SEED";

const shopRow = (c: CatalogueEntry, active: boolean) =>
  `  (${[q(c.slug), q(c.display_name), q(c.category), q(c.description), n(c.price_coins), n(c.price_gems), q(c.tier), q(c.slot), "FALSE", c.stackable ? "TRUE" : "FALSE", n(c.stock), q(c.catalogue_ref), n(c.position), active ? "TRUE" : "FALSE"].join(", ")})`;

export function craftingSeedSql(): string {
  const species = seedSql(MATERIALS).split("\n").slice(1, -1); // the roster generator's INSERT, without its markers
  const recipes = RECIPES.map((r, i) => `  (${[q(r.id), r.output.kind === "item" ? q(r.output.key) : "NULL", r.output.kind === "weapon" ? q(r.output.key) : "NULL",
    r.output.qty, `'${JSON.stringify(r.ingredients)}'::jsonb`, `ARRAY[${r.sources.map(q).join(",")}]::text[]`, i + 1].join(", ")})`);
  return [
    SEED_BEGIN,
    ...species,
    "INSERT INTO shop_items (slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, position, active) VALUES",
    [...CRAFTED_ITEMS.map(c => shopRow(c, false)), ...RECIPE_CARDS.map(c => shopRow(c, true))].join(",\n"),
    "ON CONFLICT (slug) DO NOTHING;",
    "INSERT INTO crafting_recipes (id, output_item, output_weapon, output_qty, ingredients, sources, position) VALUES",
    recipes.join(",\n"),
    "ON CONFLICT (id) DO NOTHING;",
    SEED_END,
  ].join("\n");
}
