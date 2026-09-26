/**
 * Crafting data (specs/crafting.md, rows 58, 60, 62, 63, 94, 129, 193, 198, 199):
 * 31 recipes built from the collections roster (ingredients) and the economy
 * catalogue (outputs), plus what crafting adds to both: the tree branch
 * material, the craft-only outputs (tool tiers 3-5, top outfits) and the shop's
 * recipe cards. Combat gear outputs are existing `weapons` rows.
 * Mirrored into supabase/migrations/20260926160000_crafting.sql by
 * scripts/gen-crafting-seed.mjs; crafting.test.ts keeps them in sync.
 */
import type { Species } from "@/lib/collections/roster";
import { WEAPONS } from "@/lib/combat/weapons";
import { CATALOGUE, type CatalogueEntry } from "@/lib/wallet/catalogue";

/** Where a recipe can be learned. `starter` recipes are known by everyone. */
export type RecipeSource = "starter" | "shop" | "bottle" | "quest";

export interface Recipe {
  id: string;
  output: { kind: "item" | "weapon"; key: string; qty: number };
  /** Collection item key → count, consumed from member_collections. */
  ingredients: Record<string, number>;
  sources: RecipeSource[];
}

/** Crafting materials that are not museum species: dropped by shaking trees. */
export const MATERIALS: Species[] = [{
  key: "wood_branch", category: "mineral", sub: "wood", name: "Tree branch", biome: "trees", tool: "hand", rarity: "common",
  size: null, hours: null, rainAnyHour: false, weather: [], months: [], oneLiner: "Shake a tree and one usually falls out.",
  icon: null, model: null, assetReady: false, donatable: false, wing: null, position: 101,
}];

let pos = 100;
const item = (slug: string, display_name: string, category: CatalogueEntry["category"], value: number, x: Partial<CatalogueEntry> = {}): CatalogueEntry => ({
  slug, display_name, category, description: "", price_coins: value, price_gems: null, tier: null, slot: null,
  special_pool: false, stackable: false, stock: null, catalogue_ref: null, sprite_url: null, position: ++pos, ...x,
});
const tool = (slug: string, name: string, slot: "rod" | "net" | "shovel", tier: 3 | 4 | 5, x: Partial<CatalogueEntry> = {}) =>
  item(slug, name, "tool", { 3: 1200, 4: 3000, 5: 6000 }[tier], { tier: "premium", slot, description: `Tier ${tier}. Crafted at a workbench.`, ...x });

/**
 * Craft-only outputs (rows 94, 193, 62). Seeded inactive: never on sale, but
 * they sit in member_inventory like any shop item. `price_coins` is only the
 * catalogue's one-price rule (their nominal value); nothing charges it.
 */
export const CRAFTED_ITEMS: CatalogueEntry[] = [
  tool("rod-lighthouse", "Lighthouse rod", "rod", 4, { catalogue_ref: "rod_lighthouse", description: "Tier 4. Legendary fish will bite." }),
  tool("rod-tidewarden", "Tidewarden rod", "rod", 5, { catalogue_ref: "rod_tidewarden", description: "Tier 5. The widest bite window on the island." }),
  tool("net-silk", "Silk net", "net", 3),
  tool("net-dragonfly", "Dragonfly net", "net", 4),
  tool("net-emperor", "Emperor net", "net", 5),
  tool("shovel-sturdy", "Sturdy shovel", "shovel", 3),
  tool("shovel-crystal", "Crystal shovel", "shovel", 4),
  tool("shovel-gold", "Golden shovel", "shovel", 5),
  // Wearables: catalogue_ref is the character part the item unlocks (its `item` in the character catalogue).
  item("acc-flower-crown", "Flower crown", "accessory", 200, { slot: "accessory", catalogue_ref: "acc_flower_crown" }),
  item("acc-shell-necklace", "Shell necklace", "accessory", 250, { slot: "accessory", catalogue_ref: "acc_shell_necklace" }),
  item("acc-crystal-circlet", "Crystal circlet", "accessory", 2000, { slot: "accessory", catalogue_ref: "acc_crystal_circlet", description: "Rare. Catches the lamplight." }),
  item("outfit-silk-sweater", "Silk sweater", "outfit", 300, { slot: "outfit", catalogue_ref: "outfit_silk_sweater" }),
  item("outfit-monarch-cape", "Monarch cape", "outfit", 1500, { slot: "outfit", catalogue_ref: "outfit_monarch_cape", description: "Rare. Orange and black, like October." }),
  item("outfit-koi-kimono", "Koi kimono", "outfit", 4000, { slot: "outfit", catalogue_ref: "outfit_koi_kimono", description: "Rare. Woven around a golden koi scale." }),
];

const r = (id: string, ingredients: Record<string, number>, sources: RecipeSource[], kind: "item" | "weapon" = "item", qty = 1): Recipe =>
  ({ id, output: { kind, key: id, qty }, ingredients, sources });

export const RECIPES: Recipe[] = [
  // Tools, tiers 3-5 (rows 193, 198); rods 4-5 are the only way past the legendary gate.
  r("rod-glass", { wood_branch: 4, rock_crystal: 1, rock_clay: 2 }, ["bottle"]),
  r("rod-lighthouse", { wood_branch: 6, rock_iron_nugget: 3, sea_pearl_oyster: 1, fish_black_bass: 1 }, ["quest", "bottle"]),
  r("rod-tidewarden", { wood_branch: 8, rock_gold_nugget: 1, rock_crystal: 2, fish_tuna: 1, sea_giant_isopod: 1 }, ["quest", "bottle"]),
  r("net-silk", { wood_branch: 4, bug_bagworm: 3 }, ["bottle"]),
  r("net-dragonfly", { wood_branch: 5, rock_iron_nugget: 2, bug_darner_dragonfly: 2 }, ["bottle"]),
  r("net-emperor", { wood_branch: 6, rock_gold_nugget: 1, bug_emperor_butterfly: 1, bug_rhinoceros_beetle: 1 }, ["quest", "bottle"]),
  r("shovel-sturdy", { wood_branch: 2, rock_iron_nugget: 3, rock_stone: 2 }, ["shop"]),
  r("shovel-crystal", { wood_branch: 3, rock_iron_nugget: 3, rock_crystal: 2 }, ["bottle"]),
  r("shovel-gold", { wood_branch: 3, rock_iron_nugget: 4, rock_gold_nugget: 2 }, ["quest", "bottle"]),
  // Outfits and accessories; the rare ones need rare catches (row 62).
  r("acc-straw-hat", { wood_branch: 3 }, ["starter"]),
  r("acc-flower-crown", { flower_cosmos: 2, flower_lily: 2, flower_rose: 1 }, ["shop"]),
  r("acc-shell-necklace", { shell_scallop: 2, shell_turban: 1, shell_whelk: 1 }, ["bottle"]),
  r("outfit-silk-sweater", { bug_bagworm: 4, flower_lily: 2 }, ["bottle"]),
  r("outfit-monarch-cape", { bug_monarch_butterfly: 2, bug_bagworm: 3, flower_mum: 2 }, ["bottle"]),
  r("outfit-koi-kimono", { fish_golden_koi: 1, bug_bagworm: 4, flower_rose: 3 }, ["quest", "bottle"]),
  r("acc-crystal-circlet", { rock_crystal: 2, rock_gold_nugget: 1 }, ["quest", "bottle"]),
  // Furniture (homes catalogue pieces, stackable).
  r("furn-campfire", { wood_branch: 5, rock_stone: 3 }, ["starter"]),
  r("furn-study-chair", { wood_branch: 4 }, ["starter"]),
  r("furn-bookshelf", { wood_branch: 8 }, ["shop"]),
  r("furn-floor-lamp", { wood_branch: 2, rock_iron_nugget: 2, bug_firefly: 1 }, ["shop"]),
  r("furn-study-desk", { wood_branch: 6, rock_iron_nugget: 1 }, ["bottle"]),
  r("furn-bench-park", { wood_branch: 6, rock_iron_nugget: 2 }, ["bottle"]),
  r("furn-streetlamp", { rock_iron_nugget: 4, rock_stone: 2, bug_firefly: 1 }, ["bottle"]),
  r("furn-plant-monstera", { rock_clay: 3, wood_branch: 1 }, ["bottle"]),
  r("furn-wall-clock", { wood_branch: 3, rock_iron_nugget: 1 }, ["bottle"]),
  r("furn-wall-frame", { wood_branch: 2, flower_pansy: 1 }, ["bottle"]),
  r("furn-lounge-rug", { bug_bagworm: 3, flower_hyacinth: 2 }, ["bottle"]),
  // Combat gear: existing weapons rows, stats stay the combat system's (out of scope here).
  r("sword-iron", { rock_iron_nugget: 4, wood_branch: 2 }, ["bottle"], "weapon"),
  r("bow-yew", { wood_branch: 6, bug_bagworm: 2 }, ["bottle"], "weapon"),
  r("revolver-brass", { rock_iron_nugget: 3, rock_gold_nugget: 1 }, ["quest", "bottle"], "weapon"),
  r("staff-rune", { wood_branch: 4, rock_crystal: 2, fish_football_fish: 1 }, ["quest", "bottle"], "weapon"),
];

const NAMES = new Map<string, string>([...CATALOGUE, ...CRAFTED_ITEMS].map(c => [c.slug, c.display_name]));
for (const w of WEAPONS) NAMES.set(w.key, w.name);
export const outputName = (recipe: Recipe) => NAMES.get(recipe.output.key) ?? recipe.output.key;

/** Shop recipe cards (row 199): buying one teaches the recipe (member_inventory trigger). */
export const RECIPE_CARDS: CatalogueEntry[] = RECIPES.filter(x => x.sources.includes("shop")).map(x =>
  item(`card-${x.id}`, `${outputName(x)} recipe`, "tool", 300, { catalogue_ref: `recipe:${x.id}`, description: "Recipe card. Buying it teaches you the recipe." }));
