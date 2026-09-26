"use client";

/**
 * Dev-only `?crafting=demo`: the crafting and economy services on their
 * in-memory stores behind this page's /api/crafting, /api/economy/inventory
 * and POST /api/collections calls, so the workbench, the beach bottle, branch
 * drops and the rod gate work without a signed-in account (screenshots). Same
 * approach as collectionsDemo.ts; don't combine the two. Never in production.
 */
import { getInventory } from "@/lib/wallet/service";
import { memoryCraftingStore } from "./memoryStore";
import { craft, learnFromQuest, openBottle, recipeBook } from "./service";

const ME = "00000000-0000-4000-8000-000000000001";
let installed = false;

export function installCraftingDemo(): void {
  if (installed || process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("crafting") !== "demo") return;
  installed = true;
  const m = memoryCraftingStore();
  // Mid-game pockets: a resident taught the Lighthouse rod; two branches short of it.
  void learnFromQuest(m.store, ME, "rod-lighthouse");
  void learnFromQuest(m.store, ME, "furn-floor-lamp");
  const pockets = { wood_branch: 4, rock_iron_nugget: 5, sea_pearl_oyster: 1, fish_black_bass: 2, rock_stone: 6, rock_clay: 2, bug_firefly: 1 };
  for (const [key, n] of Object.entries(pockets)) m.eco.give(ME, key, n);
  const json = (r: { ok: boolean; status?: number; error?: string; code?: string; data?: unknown }, key: string) =>
    new Response(JSON.stringify(r.ok ? { ok: true, [key]: r.data } : { ok: false, error: r.error, code: r.code }), { status: r.ok ? 200 : (r.status ?? 500) });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    switch (url.pathname) {
      case "/api/crafting/recipes": return json(await recipeBook(m.store, ME, new Date()), "book");
      case "/api/crafting/craft": return json(await craft(m.store, ME, body), "craft");
      case "/api/crafting/learn": return json(await openBottle(m.store, ME), "learned");
      case "/api/economy/inventory": return json(await getInventory(m.eco.store, ME), "inventory");
      case "/api/collections":
        if (init?.method !== "POST") break;
        m.eco.give(ME, body.item_key, 1);
        return new Response(JSON.stringify({ item_key: body.item_key }));
    }
    return realFetch(input, init);
  };
}
