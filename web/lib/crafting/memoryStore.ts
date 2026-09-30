/** In-memory CraftingStore over the economy memory store, mirroring 20260926160000_crafting.sql and 20260930100000_recipe_drops.sql (tests, dev demo). */
import { ROSTER } from "@/lib/collections/roster";
import type { LearnedRecipe } from "@/lib/collections/store";
import { memoryEconomyStore } from "@/lib/wallet/memoryStore";
import { torontoDay } from "@/lib/wallet/rules";
import { CRAFTED_ITEMS, DROP_RARITIES, RECIPE_CARDS, RECIPE_DROP_CHANCE, RECIPE_DROPS, RECIPES, outputName, type DropRarity } from "./recipes";
import { CraftingError, type CraftingStore } from "./service";

/** `random`: crafting_catch_drop's random() (the drop's chance, then which recipe). */
export function memoryCraftingStore(eco = memoryEconomyStore(), clock: () => Date = () => new Date(), random = Math.random) {
  // The migration's seed: craft-only outputs (inactive) and recipe cards (on sale).
  [...CRAFTED_ITEMS, ...RECIPE_CARDS].forEach((c, i) => eco.items.push({
    ...c, id: `00000000-0000-4000-8000-0000000c${String(i + 1).padStart(4, "0")}`, active: RECIPE_CARDS.includes(c), available_from: null, available_until: null,
  }));
  const taught = new Map<string, { source: string; day: string | null }>(); // `${member}:${recipe}`
  const log = new Map<string, string>(); // `${member}:${key}` → recipe
  const weapons = new Set<string>(); // `${member}:${weapon}`
  const mine = <T>(map: Map<string, T>, m: string) => [...map].filter(([k]) => k.startsWith(`${m}:`)).map(([k, v]) => [k.slice(m.length + 1), v] as const);
  const inventory = (m: string) => mine(eco.inventory, m).map(([, row]) => row);
  // Mirror of the card trigger: owning a recipe card is having learned it from the shop.
  const learnedRows = (m: string) => {
    const rows = new Map(mine(taught, m).map(([id, t]) => [id, t.source]));
    for (const row of inventory(m)) {
      const id = row.item.catalogue_ref?.startsWith("recipe:") ? row.item.catalogue_ref.slice(7) : null;
      if (id && !rows.has(id)) rows.set(id, "shop");
    }
    return rows;
  };
  const knows = (m: string, id: string) => RECIPES.find(r => r.id === id)?.sources.includes("starter") || learnedRows(m).has(id);
  const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

  const store: CraftingStore = {
    async learned(m) {
      return [...learnedRows(m)].map(([recipe_id, source]) => ({ recipe_id, source }));
    },
    async materials(m) {
      return Object.fromEntries((await eco.store.collections(m)).map(r => [r.item_key, r.count]));
    },
    async owned(m) {
      return new Set([...inventory(m).map(r => r.item.slug), ...[...weapons].filter(k => k.startsWith(`${m}:`)).map(k => k.slice(m.length + 1))]);
    },
    async bottleOn(m, day) {
      return mine(taught, m).find(([, t]) => t.day === day)?.[0] ?? null;
    },
    async craft(m, id, key) {
      const recipe = RECIPES.find(r => r.id === id);
      const prior = log.get(`${m}:${key}`);
      if (prior) {
        if (prior !== id) throw new CraftingError("key_reused");
        return { qty: recipe!.output.qty, replayed: true };
      }
      if (!recipe) throw new CraftingError("not_found");
      if (!knows(m, id)) throw new CraftingError("not_learned");
      const stock = await store.materials(m);
      if (Object.entries(recipe.ingredients).some(([k, n]) => (stock[k] ?? 0) < n)) throw new CraftingError("insufficient_items");
      const { key: out, qty, kind } = recipe.output;
      if (kind === "weapon") {
        if (weapons.has(`${m}:${out}`)) throw new CraftingError("already_owned");
        weapons.add(`${m}:${out}`);
      } else {
        const it = eco.items.find(i => i.slug === out)!;
        const row = eco.inventory.get(`${m}:${it.id}`);
        if (row && !it.stackable) throw new CraftingError("already_owned");
        if (row) row.qty += qty;
        else eco.inventory.set(`${m}:${it.id}`, { item: it, qty: it.stackable ? qty : 1, equipped: false, acquired_at: clock().toISOString() });
      }
      for (const [k, n] of Object.entries(recipe.ingredients)) eco.give(m, k, -n);
      log.set(`${m}:${key}`, id);
      return { qty, replayed: false };
    },
    async learn(m, id, source) {
      if (!RECIPES.some(r => r.id === id)) throw new CraftingError("not_found");
      if (learnedRows(m).has(id)) return { learned: false };
      taught.set(`${m}:${id}`, { source, day: null });
      return { learned: true };
    },
    async openBottle(m) {
      const day = torontoDay(clock());
      const today = await store.bottleOn(m, day);
      if (today) return { recipe_id: today, replayed: true };
      const pick = RECIPES.filter(r => r.sources.includes("bottle") && !r.sources.includes("starter") && !knows(m, r.id))
        .sort((a, b) => hash(`${m}${day}${a.id}`) - hash(`${m}${day}${b.id}`))[0];
      if (!pick) throw new CraftingError("nothing_left");
      taught.set(`${m}:${pick.id}`, { source: "bottle", day });
      return { recipe_id: pick.id, replayed: false };
    },
    async recipes() {
      return RECIPES;
    },
  };
  /** crafting_catch_drop: a rare catch may teach a drop recipe the member lacks (memoryCollectionsStore's land/harvest call it). */
  const catchDrop = (m: string, itemKey: string): LearnedRecipe | null => {
    const rarity = ROSTER.find(s => s.key === itemKey)?.rarity as DropRarity;
    if (!(rarity in RECIPE_DROP_CHANCE) || random() >= RECIPE_DROP_CHANCE[rarity]) return null;
    const rank = (r: DropRarity) => DROP_RARITIES.indexOf(r);
    const pool = RECIPES.filter(r => r.id in RECIPE_DROPS && rank(RECIPE_DROPS[r.id]) <= rank(rarity) && !knows(m, r.id));
    const pick = pool[Math.floor(random() * pool.length)];
    if (!pick) return null;
    taught.set(`${m}:${pick.id}`, { source: "catch", day: null });
    return { id: pick.id, name: outputName(pick) };
  };
  return { store, eco, catchDrop };
}
