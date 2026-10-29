"use client";

/**
 * Dev-only `?collections=demo`: the collections service on its in-memory
 * store, so the journal, museum, trophies, catch cards and the fishing
 * tourney board show mid-game data without a signed-in account; and the shop's
 * counter (its shelves, the till and selling from the demo's pockets).
 */
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { torontoParts } from "@/lib/time";
import { bagAction, bagView, catchAction, donate, getShowcase, journal, museum, records, setShowcase, tourney, trophies } from "@/lib/collections/service";
import { chefOrder, fishRequests, speciesClass, speciesSellPrice, torontoDay } from "@/lib/wallet/rules";
import { SUSHI_MENU } from "@/lib/wallet/catalogue";
import type { ActiveBuff } from "@/lib/wallet/store";
import { memoryEconomyStore } from "@/lib/wallet/memoryStore";
import { buy, getShop } from "@/lib/wallet/service";
import { ROSTER } from "@/lib/collections/roster";
import { MATERIALS } from "@/lib/crafting/recipes";
import { TREATS } from "@/lib/collections/treats";
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
    // The fish market's requests (f-requests) as the server would pick them on a world with sea and river; `?requests=1`
    // puts one of each of today's first two in the pockets, so the board has something to hand over.
    const filled = new Set<string>(), requestsToday = () => fishRequests(torontoDay(new Date()), ["sea", "river"]);
    const chefToday = () => chefOrder(torontoDay(new Date()), ["sea", "river"]);
    let meal: ActiveBuff | null = null;
    if (query.get("requests")) for (const r of [...requestsToday().slice(0, 2), chefToday()]) if (r) m.give(ME, r.item_key, 1);
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
            // What the counter will buy from the demo's pockets (the service's sellList over the bag: the species price, locks shown).
            const rows = (await m.store.bag(ME)).items.flatMap(r => {
              const cls = speciesClass(r.item_key), price = speciesSellPrice(r.item_key);
              if (!cls || !price || r.count < 1) return [];
              const name = [...ROSTER, ...MATERIALS, ...TREATS].find(sp => sp.key === r.item_key)?.name ?? r.item_key;
              return [{ item_key: r.item_key, name, category: cls.category, rarity: cls.rarity, count: r.count, price_each: price, locked: r.locked === true }];
            }).sort((a, b) => b.price_each - a.price_each || a.name.localeCompare(b.name));
            return reply({ ok: true, data: rows }, "sellable");
          }
          // The shop's sale over the demo's pockets (economy_sell's rules: the species price, a locked one refused).
          const row = (await m.store.bag(ME)).items.find(r => r.item_key === body.item_key);
          const price = speciesSellPrice(body.item_key);
          if (!row || !price || row.count < body.qty) return reply({ ok: false, status: 409, code: "insufficient_items", error: "You don't have that many." }, "sale");
          if (row.locked) return reply({ ok: false, status: 409, code: "locked", error: "That's locked in your bag. Unlock it to sell it." }, "sale");
          m.give(ME, body.item_key, -body.qty);
          eco.fund(ME, eco.coinsOf(ME) + price * body.qty);
          return reply({ ok: true, data: { balance: eco.coinsOf(ME), remaining: row.count - body.qty, paid: price * body.qty, replayed: false } }, "sale");
        }
        case "/api/economy/requests": {
          const chef = chefToday();
          if (method !== "POST") return reply({ ok: true, data: { day: torontoDay(now), requests: requestsToday().map(r => ({ ...r, filled: filled.has(r.item_key) })), chef: chef && { ...chef, filled: filled.has(`chef:${chef.item_key}`) } } }, "requests");
          const req = body.board === "chef" ? (chef?.item_key === body.item_key ? chef : null) : requestsToday().find(r => r.item_key === body.item_key);
          const row = (await m.store.bag(ME)).items.find(r => r.item_key === body.item_key), tag = body.board === "chef" ? `chef:${body.item_key}` : body.item_key;
          if (!req) return reply({ ok: false, status: 409, code: "not_requested", error: "The fish market isn't asking for that today." }, "fill");
          if (filled.has(tag)) return reply({ ok: false, status: 409, code: "already_filled", error: "You've already brought that one in today." }, "fill");
          if (!row || row.count < 1) return reply({ ok: false, status: 409, code: "insufficient_items", error: "You don't have that many." }, "fill");
          m.give(ME, req.item_key, -1);
          filled.add(tag);
          if (chef && req === chef) meal = { source: "staff_meal", luck: chef.meal.luck, size: chef.meal.size, until: new Date(now.getTime() + chef.meal.minutes * 60_000).toISOString() };
          eco.fund(ME, eco.coinsOf(ME) + req.reward);
          return reply({ ok: true, data: { balance: eco.coinsOf(ME), remaining: row.count - 1, paid: req.reward, replayed: false } }, "fill");
        }
        case "/api/collections/records": return reply(await records(m.store, ME, now), "records");
        case "/api/economy/sushi": {
          if (meal && new Date(meal.until) <= now) meal = null;
          if (method !== "POST") return reply({ ok: true, data: { menu: SUSHI_MENU, buff: meal } }, "sushi");
          // The bar's order over the demo's pockets and till (sushi_order's rules: coins, or one epic or legendary fish for the feast).
          const dish = SUSHI_MENU.find(d => d.id === body.dish);
          if (!dish) return reply({ ok: false, status: 404, code: "not_found", error: "That isn't on the menu." }, "order");
          if (dish.price === null) {
            const row = (await m.store.bag(ME)).items.find(r => r.item_key === body.fish);
            if (!row || row.count < 1) return reply({ ok: false, status: 409, code: "insufficient_items", error: "You don't have that many." }, "order");
            m.give(ME, body.fish, -1);
          } else {
            if (eco.coinsOf(ME) < dish.price) return reply({ ok: false, status: 409, code: "insufficient", error: "Not enough in your wallet for that." }, "order");
            eco.fund(ME, eco.coinsOf(ME) - dish.price);
          }
          meal = { source: dish.id, luck: dish.buff.luck, size: dish.buff.size, until: new Date(now.getTime() + dish.buff.minutes * 60_000).toISOString() };
          return reply({ ok: true, data: { balance: eco.coinsOf(ME), paid: dish.price ?? 0, buff: meal, replayed: false } }, "order");
        }
        case "/api/economy/shop": return reply(await getShop(eco.store, ME, now), "shop");
        case "/api/economy/buy": return reply(await buy(eco.store, ME, body, now), "purchase");
        case "/api/economy/wallet": return reply({ ok: true, data: { coins: eco.coinsOf(ME), gems: eco.gemsOf(ME), daily_claimed: true, day: "", recent: [] } }, "wallet");
        default: return null;
      }
    };
  });
}
