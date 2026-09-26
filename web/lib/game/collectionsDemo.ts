"use client";

/**
 * Dev-only `?collections=demo`: runs the systems agent's collections service
 * on its in-memory store (lib/collections/memoryStore) and routes this page's
 * /api/collections calls to it, so the journal, museum, trophies and catch
 * cards show mid-game data without a signed-in account. Same approach as
 * progressionDemo.ts. Never active in production builds.
 */
import { memoryCollectionsStore } from "@/lib/collections/memoryStore";
import { torontoParts } from "@/lib/time";
import { donate, getShowcase, journal, museum, recordCatch, setShowcase, trophies } from "@/lib/collections/service";

const ME = "00000000-0000-4000-8000-000000000001";
const OTHERS = [["00000000-0000-4000-8000-0000000001a1", "Maya Chen"], ["00000000-0000-4000-8000-0000000001a2", "Jordan Park"], ["00000000-0000-4000-8000-0000000001a3", "Priya Shah"]] as const;
let installed = false;

export function installCollectionsDemo(): void {
  if (installed || process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  if (new URLSearchParams(window.location.search).get("collections") !== "demo") return;
  installed = true;
  const clock = () => new Date();
  const m = memoryCollectionsStore(clock);
  m.name(ME, "You");
  OTHERS.forEach(([id, name]) => m.name(id, name));
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
  })();
  const json = (r: { ok: boolean; status?: number; error?: string; code?: string; data?: unknown }, key: string) =>
    new Response(JSON.stringify(r.ok ? { ok: true, [key]: r.data } : { ok: false, error: r.error, code: r.code }), { status: r.ok ? 200 : (r.status ?? 500) });
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    if (!url.pathname.startsWith("/api/collections")) return realFetch(input, init);
    await ready;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const now = new Date();
    switch (url.pathname) {
      case "/api/collections":
        if (init?.method === "POST") {
          const r = await recordCatch(m.store, ME, body.item_key, body.size_cm);
          return new Response(JSON.stringify(r.ok ? { ok: true, catch: r.data, ...r.data } : { error: r.error }), { status: r.ok ? 200 : 500 });
        }
        return new Response(JSON.stringify({ collections: (await m.store.memberItems(ME)).map(i => ({ item_key: i.item_key, count: i.count })) }));
      case "/api/collections/journal": {
        const hour = torontoParts(now).hour;
        return json(await journal(m.store, ME, url.searchParams.get("category") ?? "fish", { hour, month: now.getMonth() + 1, weather: "clear" }), "page");
      }
      case "/api/collections/museum": return json(await museum(m.store), "wings");
      case "/api/collections/museum/donate": return json(await donate(m.store, ME, body.species_key, body.idempotency_key), "donation");
      case "/api/collections/trophies": return json(await trophies(m.store, now), "case");
      case "/api/collections/showcase":
        return json(init?.method === "PUT" ? await setShowcase(m.store, ME, body.items) : await getShowcase(m.store, ME), "showcase");
      default: return realFetch(input, init);
    }
  };
}
