"use client";

/**
 * Dev-only `?crafting=demo`: the crafting and economy services on their
 * in-memory stores behind this page's /api/crafting, /api/economy/inventory
 * and POST /api/collections calls, so the workbench, the beach bottle, branch
 * drops and the rod gate work signed out (screenshots). Don't combine with
 * `?collections=demo` (both answer POST /api/collections).
 */
import { installDemoFetch, reply } from "@/lib/game/demoFetch";
import { getInventory } from "@/lib/wallet/service";
import { memoryCraftingStore } from "./memoryStore";
import { craft, learnFromQuest, openBottle, recipeBook } from "./service";

const ME = "00000000-0000-4000-8000-000000000001";

export function installCraftingDemo(): void {
  installDemoFetch("crafting", "/api/", () => {
    const m = memoryCraftingStore();
    // Mid-game pockets: a resident taught the Lighthouse rod; two branches short of it.
    void learnFromQuest(m.store, ME, "rod-lighthouse");
    void learnFromQuest(m.store, ME, "furn-floor-lamp");
    const pockets = { wood_branch: 4, rock_iron_nugget: 5, sea_pearl_oyster: 1, fish_black_bass: 2, rock_stone: 6, rock_clay: 2, bug_firefly: 1 };
    for (const [key, n] of Object.entries(pockets)) m.eco.give(ME, key, n);
    return async (path, body, _url, method) => {
      switch (path) {
        case "/api/crafting/recipes": return reply(await recipeBook(m.store, ME, new Date()), "book");
        case "/api/crafting/craft": return reply(await craft(m.store, ME, body), "craft");
        case "/api/crafting/learn": return reply(await openBottle(m.store, ME), "learned");
        case "/api/economy/inventory": return reply(await getInventory(m.eco.store, ME), "inventory");
        case "/api/collections":
          if (method !== "POST") return null;
          m.eco.give(ME, body.item_key, 1);
          return new Response(JSON.stringify({ item_key: body.item_key }));
        default: return null;
      }
    };
  });
}
