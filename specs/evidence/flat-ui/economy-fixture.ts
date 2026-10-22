// The economy the evidence member sees on the portal's shop pages (step 2): the in-memory store seeded like
// /dev/economy (the pending club merch on the shelf, a pickup waiting), answered by the same service code as
// /api/economy/*. shots-steps.mjs runs it once:  npx vite-node -c web/vitest.config.ts <this file> <out.json>
import { writeFileSync } from "node:fs";
import { memoryEconomyStore } from "@/lib/wallet/memoryStore";
import { PENDING_MERCH } from "@/lib/wallet/catalogue";
import * as S from "@/lib/wallet/service";

const ME = "00000000-0000-4000-8000-0000000000a1";
const m = memoryEconomyStore();
PENDING_MERCH.forEach((c, i) => m.items.push({ ...c, id: `00000000-0000-4000-8000-0000000f${String(i + 1).padStart(4, "0")}`, active: true, available_from: null, available_until: null }));
m.name(ME, "Juniper");
m.fund(ME, 0, 0);
const now = new Date("2026-10-17T18:05:00Z");
await m.store.credit(ME, "coins", 900, "study", "session", "f-study-1");
await m.store.credit(ME, "coins", 100, "chapter", "settle-in", "f-chapter-1");
await m.store.credit(ME, "coins", 1400, "event", "workshop", "f-event-1");
await m.store.credit(ME, "gems", 900, "admin", "Bounty: accessibility audit", "f-gems-1");
for (const [k, n] of [["fish_black_bass", 1], ["fish_carp", 4], ["fish_dace", 6], ["bug_monarch_butterfly", 2], ["apple", 5], ["shell_whelk", 1]] as const) m.give(ME, k, n);
const id = (slug: string) => m.items.find((i) => i.slug === slug)!.id;
await S.buy(m.store, ME, { item_id: id("rod-basic"), qty: 1, idempotency_key: "f-buy-1" }, now);
await S.buy(m.store, ME, { item_id: id("acc-straw-hat"), qty: 1, idempotency_key: "f-buy-2" }, now);
await S.buy(m.store, ME, { item_id: id("furn-floor-lamp"), qty: 2, idempotency_key: "f-buy-3" }, now);
await S.equip(m.store, ME, { item_id: id("acc-straw-hat"), equipped: true });
await S.reserveMerch(m.store, ME, { item_id: id("merch-sticker-pack"), idempotency_key: "f-merch-1" });
const unwrap = async <T>(p: Promise<unknown>): Promise<T> => { const r = (await p) as { ok: boolean; data?: T; error?: string } & T; return ("ok" in r && "data" in r ? r.data : r) as T; };
const out = {
  wallet: await unwrap(S.getWallet(m.store, ME, now)),
  shop: await unwrap(S.getShop(m.store, ME, now)),
  sellable: await unwrap(S.sellList(m.store, ME)),
  inventory: await unwrap(S.getInventory(m.store, ME)),
  merch: await unwrap(S.merchView(m.store, ME, now)),
};
writeFileSync(process.argv[2] ?? "economy.json", JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, JSON.stringify(v).length])));
