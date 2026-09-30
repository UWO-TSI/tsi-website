"use client";

/**
 * Dev-only `?crafting=demo`: the crafting and economy services on their
 * in-memory stores behind this page's /api/crafting, /api/economy/{inventory,shop,buy}
 * and POST /api/collections calls, so the workbench, the beach bottle, branch
 * drops, rare-catch recipe drops and the rod gate work signed out
 * (screenshots). The demo's drop dice always land: every rare catch teaches
 * a recipe here (the real chances are in recipe_drop_chances). Don't combine
 * with `?collections=demo` (both answer POST /api/collections).
 */
import { installDemoFetch, reply } from "@/lib/game/demoFetch";
import { buy, getInventory, getShop } from "@/lib/wallet/service";
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { catchAction } from "@/lib/collections/service";
import { memoryCraftingStore } from "./memoryStore";
import { craft, learnFromQuest, openBottle, recipeBook } from "./service";

const ME = "00000000-0000-4000-8000-000000000001";

export function installCraftingDemo(): void {
  installDemoFetch("crafting", "/api/", () => {
    const m = memoryCraftingStore(undefined, undefined, () => 0);
    // Mid-game pockets: a resident taught the Lighthouse rod; two branches short of it.
    void learnFromQuest(m.store, ME, "rod-lighthouse");
    void learnFromQuest(m.store, ME, "furn-floor-lamp");
    const pockets = { wood_branch: 4, rock_iron_nugget: 5, sea_pearl_oyster: 1, fish_black_bass: 2, rock_stone: 6, rock_clay: 2, bug_firefly: 1 };
    for (const [key, n] of Object.entries(pockets)) m.eco.give(ME, key, n);
    m.eco.fund(ME, 1500);
    const rolls = memoryCollectionsStore(() => new Date(), m.catchDrop);
    return async (path, body, _url, method) => {
      switch (path) {
        case "/api/crafting/recipes": return reply(await recipeBook(m.store, ME, new Date()), "book");
        case "/api/crafting/craft": return reply(await craft(m.store, ME, body), "craft");
        case "/api/crafting/learn": return reply(await openBottle(m.store, ME), "learned");
        case "/api/economy/inventory": return reply(await getInventory(m.eco.store, ME), "inventory");
        // The shop too, so wardrobe/decorate ownership can be bought into signed out.
        case "/api/economy/shop": return reply(await getShop(m.eco.store, ME, new Date()), "shop");
        case "/api/economy/buy": return reply(await buy(m.eco.store, ME, body, new Date()), "purchase");
        case "/api/collections": {
          if (method !== "POST") return null;
          const r = await catchAction(rolls.store, ME, body, new Date(), async () => "clear");
          if (r.ok && !("roll" in r.data)) m.eco.give(ME, r.data.item_key, 1);
          return reply(r, "catch");
        }
        default: return null;
      }
    };
  });
}
