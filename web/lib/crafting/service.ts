/**
 * Crafting service (specs/crafting.md): the recipe book view, crafting, the
 * beach bottle and the resident-quest learning hook. The database functions
 * in 20260926160000_crafting.sql make every check again and apply writes
 * atomically; clients name a recipe and a key, never a quantity or a price.
 */
import { ROSTER } from "@/lib/collections/roster";
import { CATALOGUE } from "@/lib/wallet/catalogue";
import { torontoDay } from "@/lib/wallet/rules";
import { CRAFTED_ITEMS, MATERIALS, RECIPES, outputName, type Recipe } from "./recipes";

export type CraftingErrorCode = "unavailable" | "not_found" | "not_learned" | "insufficient_items" | "already_owned" | "key_reused" | "nothing_left" | "failed";
export class CraftingError extends Error {
  constructor(public code: CraftingErrorCode, message?: string) {
    super(message ?? code);
  }
}

export interface CraftingStore {
  learned(memberId: string): Promise<{ recipe_id: string; source: string }[]>;
  /** Collection stock by item key (member_collections.count). */
  materials(memberId: string): Promise<Record<string, number>>;
  /** Output keys already owned: shop item slugs and weapon keys. */
  owned(memberId: string): Promise<Set<string>>;
  /** Recipe the member's bottle taught on this Toronto day, if opened. */
  bottleOn(memberId: string, day: string): Promise<string | null>;
  craft(memberId: string, recipeId: string, key: string): Promise<{ qty: number; replayed: boolean }>;
  learn(memberId: string, recipeId: string, source: "quest" | "admin"): Promise<{ learned: boolean }>;
  openBottle(memberId: string): Promise<{ recipe_id: string; replayed: boolean }>;
}

type Result<T> = { ok: true; data: T } | { ok: false; status: number; error: string; code: string };
const ERR: Record<CraftingErrorCode, [number, string]> = {
  unavailable: [503, "The workbench isn't set up yet."],
  not_found: [404, "There's no recipe like that."],
  not_learned: [403, "You haven't learned that recipe yet."],
  insufficient_items: [409, "You're missing some materials."],
  already_owned: [409, "You already have one of those."],
  key_reused: [409, "That request was already used for another recipe."],
  nothing_left: [409, "The bottle is empty. You already know every recipe the tide brings."],
  failed: [500, "Something went wrong. Try again."],
};
async function run<T>(f: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await f() };
  } catch (err) {
    const code = err instanceof CraftingError ? err.code : "failed";
    const [status, error] = ERR[code];
    return { ok: false, status, error, code };
  }
}

const STACKABLE = new Set([...CATALOGUE, ...CRAFTED_ITEMS].filter(c => c.stackable).map(c => c.slug));
const INGREDIENT_NAME = new Map([...ROSTER, ...MATERIALS].map(s => [s.key, s.name]));
const INGREDIENT_ICON = new Map([...ROSTER, ...MATERIALS].map(s => [s.key, s.icon]));
const known = (rows: { recipe_id: string; source: string }[]) =>
  new Map([...RECIPES.filter(r => r.sources.includes("starter")).map(r => [r.id, "starter"] as const), ...rows.map(r => [r.recipe_id, r.source] as const)]);

export interface RecipeView {
  id: string;
  name: string;
  kind: Recipe["output"]["kind"];
  qty: number;
  source: string;
  ingredients: { key: string; name: string; icon: string | null; need: number; have: number }[];
  owned: boolean;
  can_craft: boolean;
}
export interface RecipeBook {
  recipes: RecipeView[];
  total: number;
  bottle: { available: boolean };
}

export const recipeBook = (store: CraftingStore, m: string, now: Date) =>
  run<RecipeBook>(async () => {
    const [rows, stock, owned, bottle] = await Promise.all([store.learned(m), store.materials(m), store.owned(m), store.bottleOn(m, torontoDay(now))]);
    const learned = known(rows);
    const recipes = RECIPES.filter(r => learned.has(r.id)).map((r): RecipeView => {
      const ingredients = Object.entries(r.ingredients).map(([key, need]) => ({ key, name: INGREDIENT_NAME.get(key) ?? key, icon: INGREDIENT_ICON.get(key) ?? null, need, have: stock[key] ?? 0 }));
      const blocked = owned.has(r.output.key) && (r.output.kind === "weapon" || !STACKABLE.has(r.output.key));
      return { id: r.id, name: outputName(r), kind: r.output.kind, qty: r.output.qty, source: learned.get(r.id)!, ingredients, owned: blocked, can_craft: !blocked && ingredients.every(i => i.have >= i.need) };
    });
    const unlearnedBottle = RECIPES.some(r => r.sources.includes("bottle") && !learned.has(r.id));
    return { recipes, total: RECIPES.length, bottle: { available: !bottle && unlearnedBottle } };
  });

export const craft = (store: CraftingStore, m: string, input: { recipe_id: string; idempotency_key: string }) =>
  run(async () => {
    const recipe = RECIPES.find(r => r.id === input.recipe_id);
    if (!recipe) throw new CraftingError("not_found");
    const r = await store.craft(m, recipe.id, input.idempotency_key);
    return { id: recipe.id, name: outputName(recipe), kind: recipe.output.kind, ...r };
  });

export const openBottle = (store: CraftingStore, m: string) =>
  run(async () => {
    const r = await store.openBottle(m);
    const recipe = RECIPES.find(x => x.id === r.recipe_id);
    return { id: r.recipe_id, name: recipe ? outputName(recipe) : r.recipe_id, replayed: r.replayed };
  });

/** Resident personal quests call this when they reward a recipe (row 199). Server-side only. */
export const learnFromQuest = (store: CraftingStore, m: string, recipeId: string) => run(() => store.learn(m, recipeId, "quest"));
