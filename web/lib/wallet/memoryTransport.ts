/** In-memory EconomyTransport over the real service (dev harness, tests). */
import { memoryEconomyStore } from "./memoryStore";
import * as S from "./service";
import { EconomyRequestError, type EconomyTransport } from "./transport";

export function memoryEconomyTransport(me: string, m = memoryEconomyStore(), clock: () => Date = () => new Date()): EconomyTransport {
  const u = async <T>(p: Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code: string }>): Promise<T> => {
    const r = await p;
    if (!r.ok) throw new EconomyRequestError(r.error, r.status, r.code);
    return r.data;
  };
  return {
    wallet: () => u(S.getWallet(m.store, me, clock())),
    shop: () => u(S.getShop(m.store, me, clock())),
    buy: (id, qty, key) => u(S.buy(m.store, me, { item_id: id, qty, idempotency_key: key }, clock())),
    sellable: () => u(S.sellList(m.store, me)),
    sell: (k, qty, key) => u(S.sell(m.store, me, { item_key: k, qty, idempotency_key: key })),
    inventory: () => u(S.getInventory(m.store, me)),
    equip: (id, on) => u(S.equip(m.store, me, { item_id: id, equipped: on })),
    dailyGift: () => u(S.claimDailyGift(m.store, me)),
    merch: () => u(S.merchView(m.store, me, clock())),
    reserve: (id, key) => u(S.reserveMerch(m.store, me, { item_id: id, idempotency_key: key })),
    adminReservations: (status) => u(S.adminReservations(m.store, status as never)),
    resolve: (id, action, note) => u(S.resolveMerch(m.store, me, { reservation_id: id, action, note })),
  };
}
