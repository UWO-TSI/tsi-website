"use client";

/**
 * Dev-only `?collections=demo`: the collections service on its in-memory
 * store, so the journal, museum, trophies, catch cards and the fishing
 * tourney board show mid-game data without a signed-in account.
 */
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { torontoParts } from "@/lib/time";
import { catchAction, donate, getShowcase, journal, museum, recordCatch, setShowcase, tourney, trophies } from "@/lib/collections/service";
import { DEFAULT_GOALS } from "@/lib/progression/defaults";
import { latestTourney } from "@/lib/progression/seasonal";
import { installDemoFetch, reply } from "./demoFetch";

const ME = "00000000-0000-4000-8000-000000000001";
const OTHERS = [["00000000-0000-4000-8000-0000000001a1", "Maya Chen"], ["00000000-0000-4000-8000-0000000001a2", "Jordan Park"], ["00000000-0000-4000-8000-0000000001a3", "Priya Shah"]] as const;
/** More anglers for the tourney board, so "You" lands in its private bottom half. */
const ANGLERS = [["00000000-0000-4000-8000-0000000001b1", "Sam Okafor"], ["00000000-0000-4000-8000-0000000001b2", "Alex Rivera"], ["00000000-0000-4000-8000-0000000001b3", "Riley Chen"], ["00000000-0000-4000-8000-0000000001b4", "Noor Haddad"]] as const;

export function installCollectionsDemo(): void {
  installDemoFetch("collections", "/api/collections", () => {
    const m = memoryCollectionsStore(() => new Date());
    m.name(ME, "You");
    [...OTHERS, ...ANGLERS].forEach(([id, name]) => m.name(id, name));
    const ready = (async () => {
      const seed: [string, string, number | null][] = [
        [ME, "fish_dace", 14], [ME, "fish_pale_chub", 11], [ME, "fish_loach", 16], [ME, "fish_black_bass", 42], [ME, "bug_common_butterfly", null],
        [ME, "bug_ladybug", null], [ME, "shell_scallop", 9], [ME, "apple", null], [ME, "flower_tulip", null],
        [OTHERS[0][0], "fish_salmon", 71], [OTHERS[0][0], "fish_dace", 17], [OTHERS[1][0], "bug_monarch_butterfly", null],
        [OTHERS[1][0], "fish_pike", 84], [OTHERS[2][0], "shell_whelk", 13], [OTHERS[2][0], "fish_sea_bass", 66],
      ];
      for (const [who, key, size] of seed) await recordCatch(m.store, who, key, size);
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
    })();
    return async (path, body, url, method) => {
      await ready;
      const now = new Date();
      switch (path) {
        case "/api/collections":
          if (method === "POST") return reply(await catchAction(m.store, ME, body, now, "clear", DEFAULT_GOALS), "catch");
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
        default: return null;
      }
    };
  });
}
