/**
 * The sale with no server, in dev only (David's playtest: "sell for fish doesnt work" on the dev server, where the lane
 * rules blank the Supabase env, so every economy route answers 503 "unavailable"). The real service runs on the
 * in-memory store instead, its pockets this browser's record of what you caught (lib/game/collections.ts, the same
 * record the bag shows signed out), so the tutorial can be played through. A production build, or a dev server with
 * Supabase, never comes here (`offline`).
 */
import { ApiError, announceWrite } from "@/lib/apiClient";
import { localCollections, spendCollected } from "@/lib/game/collections";
import { memoryEconomyStore } from "./memoryStore";
import { memoryEconomyTransport } from "./memoryTransport";
import type { SellEntry } from "./service";

/** No server to sell to: a dev build with the Supabase env blanked (so no one is signed in), and the route turned it away. */
export const offline = (e: unknown) =>
  process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_SUPABASE_URL && e instanceof ApiError && (e.status === 503 || e.status === 401);

const ME = "local";
let mem: ReturnType<typeof memoryEconomyStore> | null = null;
/** The in-memory store, its pockets made to match this browser's record. */
async function pockets() {
  mem ??= memoryEconomyStore();
  const have = new Map((await mem.store.collections(ME)).map(r => [r.item_key, r.count]));
  const stock = localCollections();
  for (const key of new Set([...have.keys(), ...Object.keys(stock)])) {
    const diff = (stock[key] ?? 0) - (have.get(key) ?? 0);
    if (diff) mem.give(ME, key, diff);
  }
  return memoryEconomyTransport(ME, mem);
}

export const localSellable = async (): Promise<SellEntry[]> => (await pockets()).sellable();

export async function localSell(itemKey: string, qty: number, key: string) {
  const sale = await (await pockets()).sell(itemKey, qty, key);
  if (!sale.replayed) spendCollected(itemKey, qty);
  // As the route's write would: the bag reads its record again.
  announceWrite("/api/economy/sell", sale);
  return sale;
}

/** Tests: a fresh store. */
export const resetLocalEconomy = () => { mem = null; };
