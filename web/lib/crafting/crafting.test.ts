import { describe, expect, it } from "vitest";
import { ROSTER } from "@/lib/collections/roster";
import { WEAPONS } from "@/lib/combat/weapons";
import { bestOwnedRod, canHook } from "@/lib/game/rods";
import { CATALOGUE } from "@/lib/wallet/catalogue";
import { buy, getInventory } from "@/lib/wallet/service";
import { memoryCraftingStore } from "./memoryStore";
import { CRAFTED_ITEMS, MATERIALS, RECIPE_CARDS, RECIPE_DROPS, RECIPES, validateRecipeDraft } from "./recipes";
import { craft, learnFromQuest, openBottle, recipeBook } from "./service";

const A = "00000000-0000-4000-8000-0000000000aa";
const noon = new Date("2026-09-24T16:00:00Z");
const ROD4 = RECIPES.find(r => r.id === "rod-lighthouse")!;
const data = async <T,>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>) => { const r = await p; if (!r.ok) throw new Error(r.error); return r.data; };
const setup = (clock = () => noon) => {
  const m = memoryCraftingStore(undefined, clock);
  const stock = (key: string) => m.eco.store.collections(A).then(rows => rows.find(r => r.item_key === key)?.count ?? 0);
  const fill = (recipe: typeof ROD4, times = 1) => Object.entries(recipe.ingredients).forEach(([k, n]) => m.eco.give(A, k, n * times));
  return { ...m, stock, fill };
};

describe("recipe data", () => {
  it("is ~30 recipes over real roster keys and catalogue outputs", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(28);
    expect(new Set(RECIPES.map(r => r.id)).size).toBe(RECIPES.length);
    const ingredients = new Set([...ROSTER, ...MATERIALS].map(s => s.key));
    const items = new Set([...CATALOGUE, ...CRAFTED_ITEMS].map(c => c.slug));
    const weapons = new Set(WEAPONS.map(w => w.key));
    for (const r of RECIPES) {
      for (const k of Object.keys(r.ingredients)) expect(ingredients.has(k), `${r.id}: ${k}`).toBe(true);
      expect((r.output.kind === "item" ? items : weapons).has(r.output.key), r.id).toBe(true);
      expect(r.sources.length, r.id).toBeGreaterThan(0);
    }
    // Rods 4-5 are craft-only: never in the shop catalogue (row 94).
    expect(CATALOGUE.some(c => c.catalogue_ref === "rod_lighthouse" || c.catalogue_ref === "rod_tidewarden")).toBe(false);
    expect(new Set(MATERIALS.map(s => s.key)).size + ROSTER.length).toBe(new Set([...ROSTER, ...MATERIALS].map(s => s.key)).size);
  });
  it("drops only bottle recipes from rare catches (the SQL seed: lib/seedMigrations.ts)", () => {
    for (const id of Object.keys(RECIPE_DROPS)) expect(RECIPES.find(r => r.id === id)?.sources, id).toEqual(["bottle"]);
    expect(Object.keys(RECIPE_DROPS).length).toBe(RECIPES.filter(r => r.sources.join() === "bottle").length);
    const row = { id: "furn-x", output_item: "furn-campfire", output_weapon: null, output_qty: 1, ingredients: { wood_branch: 1 }, sources: ["bottle"] };
    expect(validateRecipeDraft({ ...row, drop_rarity: "epic" })).toEqual([]);
    expect(validateRecipeDraft({ ...row, drop_rarity: null })).toEqual([]);
    expect(validateRecipeDraft({ ...row, drop_rarity: "common" })).toHaveLength(1);
    expect(validateRecipeDraft({ ...row, sources: ["shop"], drop_rarity: "rare" })).toHaveLength(1);
  });
});

describe("crafting", () => {
  it("refuses a recipe you haven't learned, then crafts it once learned", async () => {
    const m = setup();
    m.fill(ROD4);
    expect(await craft(m.store, A, { recipe_id: ROD4.id, idempotency_key: "craft-0001" })).toMatchObject({ ok: false, code: "not_learned" });
    expect(await m.stock("wood_branch")).toBe(6);
    expect((await data(recipeBook(m.store, A, noon))).recipes.map(r => r.id)).not.toContain(ROD4.id);
    await learnFromQuest(m.store, A, ROD4.id);
    expect(await craft(m.store, A, { recipe_id: ROD4.id, idempotency_key: "craft-0001" })).toMatchObject({ ok: true, data: { name: "Lighthouse rod", replayed: false } });
  });

  it("refuses when an ingredient is short and takes nothing", async () => {
    const m = setup();
    await learnFromQuest(m.store, A, ROD4.id);
    m.fill(ROD4);
    m.eco.give(A, "sea_pearl_oyster", -1);
    const book = (await data(recipeBook(m.store, A, noon)));
    expect(book.recipes.find(r => r.id === ROD4.id)).toMatchObject({ can_craft: false });
    expect(book.recipes.find(r => r.id === ROD4.id)!.ingredients.find(i => i.key === "sea_pearl_oyster")).toMatchObject({ need: 1, have: 0 });
    expect(await craft(m.store, A, { recipe_id: ROD4.id, idempotency_key: "craft-0002" })).toMatchObject({ ok: false, code: "insufficient_items" });
    expect(await m.stock("wood_branch")).toBe(6);
    expect(await m.stock("rock_iron_nugget")).toBe(3);
    expect((await m.store.owned(A)).has("rod-lighthouse")).toBe(false);
  });

  it("consumes ingredients exactly once on a double submit", async () => {
    const m = setup();
    const chair = RECIPES.find(r => r.id === "furn-study-chair")!; // starter, stackable
    m.fill(chair, 3);
    const first = await craft(m.store, A, { recipe_id: chair.id, idempotency_key: "craft-0003" });
    const again = await craft(m.store, A, { recipe_id: chair.id, idempotency_key: "craft-0003" });
    expect(first).toMatchObject({ ok: true, data: { replayed: false, qty: 1 } });
    expect(again).toMatchObject({ ok: true, data: { replayed: true, qty: 1 } });
    expect(await m.stock("wood_branch")).toBe(8);
    const furniture = (await data(getInventory(m.eco.store, A))).groups.furniture;
    expect(furniture.find(r => r.item.slug === "furn-study-chair")!.qty).toBe(2); // the starter chair + this one
    expect(await craft(m.store, A, { recipe_id: "acc-straw-hat", idempotency_key: "craft-0003" })).toMatchObject({ ok: false, code: "key_reused" });
    // A new key crafts a second chair (stackable); a second straw hat is refused (one per member).
    expect(await craft(m.store, A, { recipe_id: chair.id, idempotency_key: "craft-0004" })).toMatchObject({ ok: true, data: { replayed: false } });
    expect(await craft(m.store, A, { recipe_id: "acc-straw-hat", idempotency_key: "craft-0005" })).toMatchObject({ ok: true });
    m.eco.give(A, "wood_branch", 3);
    expect(await craft(m.store, A, { recipe_id: "acc-straw-hat", idempotency_key: "craft-0006" })).toMatchObject({ ok: false, code: "already_owned" });
    expect(await m.stock("wood_branch")).toBe(12 - 4 - 4 - 3 + 3);
  });

  it("unlocks the legendary fishing gate only by crafting rods 4-5", async () => {
    const m = setup();
    const rodOf = async () => bestOwnedRod((await data(getInventory(m.eco.store, A))).groups.tools?.flatMap(r => r.item.catalogue_ref ?? []) ?? []);
    expect((await rodOf()).tier).toBe(1);
    expect(canHook("legendary", await rodOf())).toBe(false);
    // Not for sale, whatever the price.
    m.eco.fund(A, 100_000);
    const id = m.eco.items.find(i => i.slug === "rod-lighthouse")!.id;
    expect(await buy(m.eco.store, A, { item_id: id, qty: 1, idempotency_key: "buy-rod4" }, noon)).toMatchObject({ ok: false, code: "not_for_sale" });
    await learnFromQuest(m.store, A, ROD4.id);
    m.fill(ROD4);
    await craft(m.store, A, { recipe_id: ROD4.id, idempotency_key: "craft-0007" });
    expect((await rodOf()).tier).toBe(4);
    expect(canHook("legendary", await rodOf())).toBe(true);
    const rod5 = RECIPES.find(r => r.id === "rod-tidewarden")!;
    await learnFromQuest(m.store, A, rod5.id);
    m.fill(rod5);
    await craft(m.store, A, { recipe_id: rod5.id, idempotency_key: "craft-0008" });
    expect((await rodOf()).tier).toBe(5);
  });

  it("gives combat gear as a weapon, once", async () => {
    const m = setup();
    const sword = RECIPES.find(r => r.output.kind === "weapon")!;
    await learnFromQuest(m.store, A, sword.id);
    m.fill(sword, 2);
    expect(await craft(m.store, A, { recipe_id: sword.id, idempotency_key: "craft-0009" })).toMatchObject({ ok: true, data: { kind: "weapon" } });
    expect((await m.store.owned(A)).has(sword.output.key)).toBe(true);
    expect(await craft(m.store, A, { recipe_id: sword.id, idempotency_key: "craft-0010" })).toMatchObject({ ok: false, code: "already_owned" });
  });
});

describe("learning", () => {
  it("opens one message bottle a Toronto day with a recipe you lack", async () => {
    let now = noon;
    const m = setup(() => now);
    expect((await data(recipeBook(m.store, A, now))).bottle.available).toBe(true);
    const first = (await data(openBottle(m.store, A)));
    expect(RECIPES.find(r => r.id === first.id)!.sources).toContain("bottle");
    expect(await data(openBottle(m.store, A))).toEqual({ ...first, replayed: true });
    const book = (await data(recipeBook(m.store, A, now)));
    expect(book.bottle.available).toBe(false);
    expect(book.recipes.find(r => r.id === first.id)).toMatchObject({ source: "bottle" });
    now = new Date("2026-09-25T16:00:00Z");
    const next = (await data(openBottle(m.store, A)));
    expect(next.id).not.toBe(first.id);
    expect(next.replayed).toBe(false);
  });

  it("teaches a recipe when you buy its card in the shop", async () => {
    const m = setup();
    const card = RECIPE_CARDS[0];
    const id = m.eco.items.find(i => i.slug === card.slug)!.id;
    m.eco.fund(A, 1000);
    expect(await buy(m.eco.store, A, { item_id: id, qty: 1, idempotency_key: "buy-card-1" }, noon)).toMatchObject({ ok: true });
    const book = (await data(recipeBook(m.store, A, noon)));
    expect(book.recipes.find(r => `recipe:${r.id}` === card.catalogue_ref)).toMatchObject({ source: "shop" });
  });

  it("knows the starter recipes from day one", async () => {
    const m = setup();
    const book = (await data(recipeBook(m.store, A, noon)));
    expect(book.recipes.map(r => r.source)).toEqual(RECIPES.filter(r => r.sources.includes("starter")).map(() => "starter"));
    expect(book.total).toBe(RECIPES.length);
  });
});
