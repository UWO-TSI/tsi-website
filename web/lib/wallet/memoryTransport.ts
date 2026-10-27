/** In-memory EconomyTransport over the real service (dev harness, tests). */
import { memoryEconomyStore } from "./memoryStore";
import * as S from "./service";
import { ApiError } from "@/lib/apiClient";
import type { EconomyTransport } from "./transport";

/** The dev harness asks for sea and river fish, the waters every world has (the server reads its own: rolls.ts activeWaters). */
const DEMO_WATERS = ["sea", "river"] as const;

export function memoryEconomyTransport(me: string, m = memoryEconomyStore(), clock: () => Date = () => new Date()): EconomyTransport {
  const u = async <T>(p: Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code: string }>): Promise<T> => {
    const r = await p;
    if (!r.ok) throw new ApiError(r.error, r.status, r.code);
    return r.data;
  };
  return {
    wallet: () => u(S.getWallet(m.store, me, clock())),
    shop: () => u(S.getShop(m.store, me, clock())),
    buy: (id, qty, key) => u(S.buy(m.store, me, { item_id: id, qty, idempotency_key: key }, clock())),
    sellable: () => u(S.sellList(m.store, me)),
    sell: (k, qty, key) => u(S.sell(m.store, me, { item_key: k, qty, idempotency_key: key })),
    requests: () => u(S.fishRequestsView(m.store, me, clock(), DEMO_WATERS)),
    fillRequest: (k, key) => u(S.fillFishRequest(m.store, me, { item_key: k, idempotency_key: key }, clock(), DEMO_WATERS)),
    inventory: () => u(S.getInventory(m.store, me)),
    equip: (id, on) => u(S.equip(m.store, me, { item_id: id, equipped: on })),
    dailyGift: () => u(S.claimDailyGift(m.store, me)),
    merch: () => u(S.merchView(m.store, me, clock())),
    reserve: (id, key) => u(S.reserveMerch(m.store, me, { item_id: id, idempotency_key: key })),
    adminReservations: (status) => u(S.adminReservations(m.store, status as never)),
    resolve: (id, action, note) => u(S.resolveMerch(m.store, me, { reservation_id: id, action, note })),
  };
}
