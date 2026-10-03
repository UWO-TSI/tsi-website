"use client";

/**
 * Dev-only `?collections=demo`: the collections service on its in-memory
 * store, so the journal, museum, trophies, catch cards and the fishing
 * tourney board show mid-game data without a signed-in account; and the shop's
 * counter (its shelves, the till and selling from the demo's pockets).
 */
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { torontoParts } from "@/lib/time";
import { bagAction, bagView, catchAction, donate, getShowcase, journal, museum, setShowcase, tourney, trophies } from "@/lib/collections/service";
import { sellPrice, speciesClass } from "@/lib/wallet/rules";
import { memoryEconomyStore } from "@/lib/wallet/memoryStore";
import { buy, getShop } from "@/lib/wallet/service";
import { ROSTER } from "@/lib/collections/roster";
import { MATERIALS } from "@/lib/crafting/recipes";
import { slotsUsed } from "@/lib/collections/bag";
import { DEFAULT_GOALS } from "@/lib/progression/defaults";
import { latestTourney } from "@/lib/progression/seasonal";
import { installDemoFetch, reply } from "./demoFetch";

const ME = "00000000-0000-4000-8000-000000000001";
const OTHERS = [["00000000-0000-4000-8000-0000000001a1", "Maya Chen"], ["00000000-0000-4000-8000-0000000001a2", "Jordan Park"], ["00000000-0000-4000-8000-0000000001a3", "Priya Shah"]] as const;
/** More anglers for the tourney board, so "You" lands in its private bottom half. */
const ANGLERS = [["00000000-0000-4000-8000-0000000001b1", "Sam Okafor"], ["00000000-0000-4000-8000-0000000001b2", "Alex Rivera"], ["00000000-0000-4000-8000-0000000001b3", "Riley Chen"], ["00000000-0000-4000-8000-0000000001b4", "Noor Haddad"]] as const;

/**
 * The demo's pockets (specs/game-ui.md milestone 2), `?bag=<slots>` to start that full (19: one pickup from full; 23:
 * over the cap, as a member was before it) and `?chest=1` for a stocked storage chest. The bag's service runs here too.
 */
const POCKETS: [string, number][] = [["wood_branch", 29], ["rock_stone", 12], ["rock_iron_nugget", 4], ["rock_clay", 6], ["apple", 9], ["fruit_orange", 3], ["flower_rose", 4],
  ["shell_scallop", 2], ["mushroom_round", 3], ["fish_carp", 1], ["fish_bluegill", 1], ["fish_salmon", 1], ["fish_squid", 1], ["fish_red_snapper", 1], ["sea_sea_star", 1],
  ["bug_monarch_butterfly", 1], ["bug_ladybug", 1], ["bug_mantis", 1], ["fish_golden_koi", 1], ["rock_gold_nugget", 1], ["bug_firefly", 1], ["fish_pike", 1], ["shell_whelk", 1]];

export function installCollectionsDemo(): void {
  installDemoFetch("collections", "/api/", (query) => {
    const m = memoryCollectionsStore(() => new Date());
    if (query.get("chest")) for (const [key, n] of [["wood_branch", 60], ["rock_stone", 34], ["rock_clay", 8], ["apple", 22], ["flower_tulip", 7], ["fish_dace", 1], ["bug_common_butterfly", 1]] as const) m.stash(ME, key, n);
    // The shop's till and shelves (the counter, ShopCounter): the economy service on its memory store, coins shared with sales.
    const eco = memoryEconomyStore();
    eco.fund(ME, 1200);
    m.name(ME, "You");
    [...OTHERS, ...ANGLERS].forEach(([id, name]) => m.name(id, name));
    const ready = (async () => {
      const seed: [string, string, number | null][] = [
        [ME, "fish_dace", 14], [ME, "fish_pale_chub", 11], [ME, "fish_loach", 16], [ME, "fish_black_bass", 42], [ME, "bug_common_butterfly", null],
        [ME, "bug_ladybug", null], [ME, "shell_scallop", 9], [ME, "apple", null], [ME, "flower_tulip", null],
        [OTHERS[0][0], "fish_salmon", 71], [OTHERS[0][0], "fish_dace", 17], [OTHERS[1][0], "bug_monarch_butterfly", null],
        [OTHERS[1][0], "fish_pike", 84], [OTHERS[2][0], "shell_whelk", 13], [OTHERS[2][0], "fish_sea_bass", 66],
      ];
      for (const [who, key, size] of seed) m.record(who, key, size);
      await donate(m.store, OTHERS[0][0], "fish_salmon", "demo-don-1");
      await donate(m.store, OTHERS[0][0], "fish_dace", "demo-don-2");
      await donate(m.store, OTHERS[1][0], "bug_monarch_butterfly", "demo-don-3");
      await donate(m.store, OTHERS[2][0], "shell_whelk", "demo-don-4");
      // The tourney running now (or the last one): the board as landed catches would leave it.
      const t = latestTourney(DEFAULT_GOALS, new Date());
      const entries: [string, string, number][] = [
        [OTHERS[1][0], "fish_sturgeon", 152], [OTHERS[1][0], "fish_pike", 84], [OTHERS[0][0], "fish_salmon", 74], [OTHERS[2][0], "fish_sea_bass", 66],
        [ANGLERS[0][0], "fish_black_bass", 51], [ANGLERS[1][0], "fish_black_bass", 44], [ANGLERS[2][0], "fish_yellow_perch", 29], [ME, "fish_yellow_perch", 26],
        [ANGLERS[3][0], "fish_dace", 17], [OTHERS[2][0], "sea_dungeness_crab", 21], [ME, "sea_sea_star", 13],
      ];
      if (t) for (const [who, key, size] of entries) m.enter(t.goal.id, t.cycle, who, key, size);
      // `?bag=<slots>`: POCKETS until the bag fills that many (each adds a slot at most).
      const fill = Number(query.get("bag") ?? 0);
      for (const [key, n] of POCKETS) {
        if (slotsUsed(Object.fromEntries((await m.store.bag(ME)).items.map(r => [r.item_key, r.count]))) >= fill) break;
        m.give(ME, key, n);
      }
    })();
    return async (path, body, url, method) => {
      await ready;
      const now = new Date();
      switch (path) {
        case "/api/collections":
          if (method === "POST") return reply(await catchAction(m.store, ME, body, now, async () => "clear", async () => DEFAULT_GOALS), "catch");
          return new Response(JSON.stringify({ collections: (await m.store.memberItems(ME)).map(i => ({ item_key: i.item_key, count: i.count })) }));
        case "/api/collections/journal": {
          const { hour, month } = torontoParts(now);
          return reply(await journal(m.store, ME, url.searchParams.get("category") ?? "fish", { hour, month, weather: "clear" }), "page");
        }
        case "/api/collections/museum": return reply(await museum(m.store), "wings");
        case "/api/collections/museum/donate": return reply(await donate(m.store, ME, body.species_key, body.idempotency_key), "donation");
        case "/api/collections/trophies": return reply(await trophies(m.store, now), "case");
        case "/api/collections/tourney": return reply(await tourney(m.store, DEFAULT_GOALS, ME, now), "tourney");
        case "/api/collections/showcase": return reply(method === "PUT" ? await setShowcase(m.store, ME, body.items) : await getShowcase(m.store, ME), "showcase");
        case "/api/collections/bag": return reply(method === "POST" ? await bagAction(m.store, ME, body) : await bagView(m.store, ME), "bag");
        case "/api/economy/sell": {
          if (method !== "POST") {
            // What the counter will buy from the demo's pockets (the service's sellList over the bag: price by rarity, locks shown).
            const rows = (await m.store.bag(ME)).items.flatMap(r => {
              const cls = speciesClass(r.item_key), price = cls ? sellPrice(cls.category, cls.rarity) : null;
              if (!cls || !price || r.count < 1) return [];
              const name = [...ROSTER, ...MATERIALS].find(sp => sp.key === r.item_key)?.name ?? r.item_key;
              return [{ item_key: r.item_key, name, category: cls.category, rarity: cls.rarity, count: r.count, price_each: price, locked: r.locked === true }];
            }).sort((a, b) => b.price_each - a.price_each || a.name.localeCompare(b.name));
            return reply({ ok: true, data: rows }, "sellable");
          }
          // The shop's sale over the demo's pockets (economy_sell's rules: the price by rarity, a locked one refused).
          const row = (await m.store.bag(ME)).items.find(r => r.item_key === body.item_key);
          const cls = speciesClass(body.item_key), price = cls && sellPrice(cls.category, cls.rarity);
          if (!row || !price || row.count < body.qty) return reply({ ok: false, status: 409, code: "insufficient_items", error: "You don't have that many." }, "sale");
          if (row.locked) return reply({ ok: false, status: 409, code: "locked", error: "That's locked in your bag. Unlock it to sell it." }, "sale");
          m.give(ME, body.item_key, -body.qty);
          eco.fund(ME, eco.coinsOf(ME) + price * body.qty);
          return reply({ ok: true, data: { balance: eco.coinsOf(ME), remaining: row.count - body.qty, paid: price * body.qty, replayed: false } }, "sale");
        }
        case "/api/economy/shop": return reply(await getShop(eco.store, ME, now), "shop");
        case "/api/economy/buy": return reply(await buy(eco.store, ME, body, now), "purchase");
        case "/api/economy/wallet": return reply({ ok: true, data: { coins: eco.coinsOf(ME), gems: eco.gemsOf(ME), daily_claimed: true, day: "", recent: [] } }, "wallet");
        default: return null;
      }
    };
  });
}
