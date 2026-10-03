/**
 * Economy service (specs/economy.md). Prices, specials and sell values are
 * decided here from server data; the database functions re-check and apply
 * them atomically. Clients name only what they want, never a price.
 */
import { ROSTER } from "@/lib/collections/roster";
import { FISH } from "@/lib/game/fishing";
import { fnv1a } from "@/lib/game/weatherSystem";
import { dailySpecials, effectivePrice, isOnSale, ownedCounts, sellPrice, speciesClass, TAB_OF, torontoDay, type ShopItem, type Special } from "./rules";
import { toFailure, type Result } from "@/lib/result";
import { EconomyError, type EconomyStore, type InventoryRow, type LedgerEntry, type Reservation } from "./store";

const ERR: Record<string, [number, string]> = {
  unavailable: [503, "The shop is closed for now."],
  insufficient: [409, "Not enough in your wallet for that."],
  not_found: [404, "That isn't in the shop."],
  not_for_sale: [409, "That isn't for sale right now."],
  already_owned: [409, "You already own that."],
  bad_qty: [400, "Pick a sensible amount."],
  bad_price: [409, "The price changed. Take another look."],
  sold_out: [409, "Sold out. Check back after a restock."],
  not_sellable: [422, "The shop doesn't buy that."],
  insufficient_items: [409, "You don't have that many."],
  too_many_open: [409, "You have three merch pickups waiting already."],
  already_resolved: [409, "That reservation is already closed."],
  forbidden: [403, "T1/T2 only."],
  not_owned: [409, "You don't own that."],
  no_slot: [422, "That isn't something you wear or hold."],
  locked: [409, "That's locked in your bag. Unlock it to sell it."],
  failed: [500, "Something went wrong. Try again."],
};
const fail = <T>(err: unknown): Result<T> => toFailure(ERR, err);
const run = async <T>(f: () => Promise<T>): Promise<Result<T>> => {
  try {
    return { ok: true, data: await f() };
  } catch (err) {
    return fail(err);
  }
};

export interface WalletView {
  coins: number;
  gems: number;
  daily_claimed: boolean;
  day: string;
  recent: LedgerEntry[];
}
export const getWallet = (store: EconomyStore, m: string, now: Date) =>
  run<WalletView>(async () => {
    const day = torontoDay(now);
    const [w, claimed, recent] = await Promise.all([store.wallet(m), store.dailyClaimed(m, day), store.ledger(m, 20)]);
    return { ...w, daily_claimed: claimed, day, recent };
  });

export interface ShopEntry {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  tier: string | null;
  currency: "coins" | "gems";
  price: number;
  base_price: number;
  special: boolean;
  stock: number | null;
  owned: number;
  can_buy: boolean;
  sprite_url: string | null;
  /** What it unlocks: character part id, `hair:<i>`, homes piece or finish. */
  catalogue_ref: string | null;
}
export interface ShopView {
  day: string;
  coins: number;
  gems: number;
  tabs: Record<"tools" | "outfits" | "furniture" | "specials" | "merch", ShopEntry[]>;
}

function entry(it: ShopItem, specials: Special[], owned: Map<string, number>, w: { coins: number; gems: number }): ShopEntry {
  const p = effectivePrice(it, specials);
  const have = owned.get(it.id) ?? 0;
  const soldOut = it.stock !== null && it.stock < 1;
  return {
    id: it.id, slug: it.slug, name: it.display_name, category: String(it.category), description: it.description ?? "", tier: it.tier,
    currency: p.currency, price: p.price, base_price: (it.price_coins ?? it.price_gems)!, special: p.special, stock: it.stock, owned: have,
    can_buy: !soldOut && (it.stackable || have === 0) && (p.currency === "coins" ? w.coins : w.gems) >= p.price, sprite_url: it.sprite_url, catalogue_ref: it.catalogue_ref,
  };
}

export const getShop = (store: EconomyStore, m: string, now: Date) =>
  run<ShopView>(async () => {
    const day = torontoDay(now);
    const [items, inv, w] = await Promise.all([store.catalogue(), store.inventory(m), store.wallet(m)]);
    const onSale = items.filter((i) => isOnSale(i, now)).sort((a, b) => a.position - b.position);
    const specials = dailySpecials(onSale, day);
    const owned = new Map(inv.map((r) => [r.item.id, r.qty]));
    const tabs: ShopView["tabs"] = { tools: [], outfits: [], furniture: [], specials: [], merch: [] };
    for (const it of onSale) {
      const e = entry(it, specials, owned, w);
      tabs[TAB_OF[String(it.category)] ?? "outfits"].push(e);
      if (e.special) tabs.specials.push(e);
    }
    return { day, ...w, tabs };
  });

export async function buy(store: EconomyStore, m: string, input: { item_id: string; qty: number; idempotency_key: string }, now: Date): Promise<Result<{ balance: number; owned: number; replayed: boolean; price_each: number; currency: "coins" | "gems" }>> {
  return run(async () => {
    const items = await store.catalogue();
    const it = items.find((i) => i.id === input.item_id);
    if (!it) throw new EconomyError("not_found");
    if (it.category === "merch") throw new EconomyError("not_for_sale");
    if (!isOnSale(it, now)) throw new EconomyError("not_for_sale");
    const p = effectivePrice(it, dailySpecials(items.filter((i) => isOnSale(i, now)), torontoDay(now)));
    const r = await store.buy(m, it.id, input.qty, p.price, input.idempotency_key);
    return { ...r, price_each: p.price, currency: p.currency };
  });
}

export interface SellEntry {
  item_key: string;
  name: string;
  category: string;
  rarity: string;
  count: number;
  price_each: number;
  /** Locked in the bag: shown, never sold (unlock it in the bag first). */
  locked: boolean;
}
const FISH_NAME = new Map(FISH.map((f) => [f.key, f.name]));
export const sellList = (store: EconomyStore, m: string) =>
  run<SellEntry[]>(async () => {
    const rows = await store.collections(m);
    return rows
      .flatMap((r) => {
        const cls = speciesClass(r.item_key);
        const price = cls ? sellPrice(cls.category, cls.rarity) : null;
        if (!cls || !price) return [];
        const name = ROSTER.find((s) => s.key === r.item_key)?.name ?? FISH_NAME.get(r.item_key) ?? r.item_key;
        return [{ item_key: r.item_key, name, category: cls.category, rarity: cls.rarity, count: r.count, price_each: price, locked: r.locked === true }];
      })
      .sort((a, b) => b.price_each - a.price_each || a.name.localeCompare(b.name));
  });

export const sell = (store: EconomyStore, m: string, input: { item_key: string; qty: number; idempotency_key: string }) =>
  run(() => store.sell(m, input.item_key, input.qty, input.idempotency_key));

export interface InventoryView {
  groups: Record<string, InventoryRow[]>;
}
/** First look at the bag grants the free starters (idempotent, once per account). */
export const getInventory = (store: EconomyStore, m: string) =>
  run<InventoryView>(async () => {
    await store.grantStarters(m);
    const groups: Record<string, InventoryRow[]> = {};
    for (const r of await store.inventory(m)) (groups[TAB_OF[String(r.item.category)] ?? "outfits"] ??= []).push(r);
    return { groups };
  });

/** Catalogue refs the member owns (starters granted first): what a look save or a home save is checked against. */
export const ownedRefs = (store: EconomyStore, m: string) =>
  run<Map<string, number>>(async () => {
    await store.grantStarters(m);
    return ownedCounts(await store.inventory(m));
  });

export const equip = (store: EconomyStore, m: string, input: { item_id: string; equipped: boolean }) =>
  run<InventoryView>(async () => {
    await store.setEquipped(m, input.item_id, input.equipped);
    const r = await getInventory(store, m);
    if (!r.ok) throw new EconomyError("failed");
    return r.data;
  });

export const claimDailyGift = (store: EconomyStore, m: string) => run(() => store.dailyGift(m));

/** Short pickup code derived from the reservation key, so a retry shows the same code. */
export function pickupCode(memberId: string, key: string): string {
  let h = fnv1a(`${memberId}:${key}`);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
  let out = "";
  for (let i = 0; i < 5; i++) {
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    out += alphabet[h % alphabet.length];
  }
  return out;
}

export const merchView = (store: EconomyStore, m: string, now: Date) =>
  run(async () => {
    const [shop, mine] = await Promise.all([getShop(store, m, now), store.reservations({ memberId: m })]);
    if (!shop.ok) throw new EconomyError("unavailable");
    return { gems: shop.data.gems, items: shop.data.tabs.merch, reservations: mine };
  });

export const reserveMerch = (store: EconomyStore, m: string, input: { item_id: string; idempotency_key: string }) =>
  run(async () => {
    const r = await store.merchReserve(m, input.item_id, input.idempotency_key, pickupCode(m, input.idempotency_key));
    const mine = await store.reservations({ memberId: m });
    return { ...r, reservation: mine.find((x) => x.id === r.reservation_id) ?? null };
  });

export const adminReservations = (store: EconomyStore, status?: Reservation["status"]) => run(() => store.reservations({ status }));
export const resolveMerch = (store: EconomyStore, actor: string, input: { reservation_id: string; action: "fulfil" | "cancel"; note?: string }) =>
  run(() => store.merchResolve(input.reservation_id, actor, input.action, input.note?.trim() || null));
