/** In-memory EconomyStore mirroring 033_economy.sql (tests, dev harness). */
import { dailyGiftAmount, SELL_PRICES, SETTINGS } from "./catalogue";
import { seedItems, sellPrice, speciesClass, torontoDay, type ShopItem } from "./rules";
import { EconomyError, type EconomyStore, type InventoryRow, type LedgerEntry, type Reservation } from "./store";

export function memoryEconomyStore(clock: () => Date = () => new Date()) {
  const items: ShopItem[] = seedItems();
  const coins = new Map<string, number>();
  const gems = new Map<string, number>();
  const ledger: (LedgerEntry & { member: string; key: string })[] = [];
  const inventory = new Map<string, InventoryRow>(); // `${member}:${itemId}`
  const collections = new Map<string, number>(); // `${member}:${key}`
  const claims = new Set<string>();
  const reservations: Reservation[] = [];
  const tiers = new Map<string, number>();
  const names = new Map<string, string>();
  let seq = 0;

  function apply(m: string, currency: "coins" | "gems", amount: number, source: string, ref: string, key: string) {
    const bal = (currency === "coins" ? coins : gems).get(m) ?? 0;
    if (ledger.some((l) => l.member === m && l.key === key && l.currency === currency)) return { balance: bal, replayed: true };
    if (bal + amount < 0) throw new EconomyError("insufficient");
    (currency === "coins" ? coins : gems).set(m, bal + amount);
    ledger.push({ member: m, key, currency, amount, balance_after: bal + amount, source, ref, created_at: clock().toISOString() });
    return { balance: bal + amount, replayed: false };
  }

  const store: EconomyStore = {
    async wallet(m) {
      return { coins: coins.get(m) ?? 0, gems: gems.get(m) ?? 0 };
    },
    async ledger(m, limit) {
      return ledger.filter((l) => l.member === m).slice(-limit).reverse().map(({ member: _m, key: _k, ...l }) => (void _m, void _k, l));
    },
    async catalogue() {
      return items.map((i) => ({ ...i }));
    },
    async inventory(m) {
      return [...inventory.entries()].filter(([k]) => k.startsWith(`${m}:`)).map(([, v]) => ({ ...v, item: { ...v.item } }));
    },
    async buy(m, itemId, qty, priceEach, key) {
      const it = items.find((i) => i.id === itemId);
      if (!it) throw new EconomyError("not_found");
      const currency = it.price_coins !== null ? "coins" : "gems";
      const k = `buy:${key}`;
      if (ledger.some((l) => l.member === m && l.key === k)) {
        return { balance: (currency === "coins" ? coins : gems).get(m) ?? 0, owned: inventory.get(`${m}:${itemId}`)?.qty ?? 0, replayed: true };
      }
      if (!it.active || it.category === "merch") throw new EconomyError("not_for_sale");
      if (qty < 1 || qty > 20 || (!it.stackable && qty !== 1)) throw new EconomyError("bad_qty");
      if (!it.stackable && inventory.has(`${m}:${itemId}`)) throw new EconomyError("already_owned");
      const base = (it.price_coins ?? it.price_gems)!;
      if (priceEach > base || priceEach < Math.floor(base / 2)) throw new EconomyError("bad_price");
      if (it.stock !== null && it.stock < qty) throw new EconomyError("sold_out");
      const r = apply(m, currency, -(priceEach * qty), "shop", it.slug, k);
      if (it.stock !== null) it.stock -= qty;
      const row = inventory.get(`${m}:${itemId}`) ?? { item: it, qty: 0, equipped: false, acquired_at: clock().toISOString() };
      row.qty += qty;
      inventory.set(`${m}:${itemId}`, row);
      return { balance: r.balance, owned: row.qty, replayed: false };
    },
    async collections(m) {
      return [...collections.entries()].filter(([k, n]) => k.startsWith(`${m}:`) && n > 0).map(([k, n]) => ({ item_key: k.slice(m.length + 1), count: n }));
    },
    async sell(m, itemKey, qty, key) {
      const k = `sell:${key}`;
      const prior = ledger.find((l) => l.member === m && l.key === k);
      if (prior) return { balance: coins.get(m) ?? 0, remaining: collections.get(`${m}:${itemKey}`) ?? 0, paid: prior.amount, replayed: true };
      if (qty < 1 || qty > 200) throw new EconomyError("bad_qty");
      const cls = speciesClass(itemKey);
      const price = cls ? sellPrice(cls.category, cls.rarity) : null;
      if (!price) throw new EconomyError("not_sellable");
      const have = collections.get(`${m}:${itemKey}`) ?? 0;
      if (have < qty) throw new EconomyError("insufficient_items");
      collections.set(`${m}:${itemKey}`, have - qty);
      const r = apply(m, "coins", price * qty, "sell", itemKey, k);
      return { balance: r.balance, remaining: have - qty, paid: price * qty, replayed: false };
    },
    async setEquipped(m, itemId, equipped) {
      const row = inventory.get(`${m}:${itemId}`);
      if (!row) throw new EconomyError("not_owned");
      if (!row.item.slot) throw new EconomyError("no_slot");
      if (equipped) for (const [k, v] of inventory) if (k.startsWith(`${m}:`) && v.item.slot === row.item.slot) v.equipped = false;
      row.equipped = equipped;
    },
    async dailyGift(m) {
      const day = torontoDay(clock());
      if (claims.has(`${m}:${day}`)) return { coins: 0, balance: coins.get(m) ?? 0, claimed: false, day };
      claims.add(`${m}:${day}`);
      const amount = dailyGiftAmount(day);
      const r = apply(m, "coins", amount, "daily_gift", day, `daily:${day}`);
      return { coins: amount, balance: r.balance, claimed: true, day };
    },
    async dailyClaimed(m, day) {
      return claims.has(`${m}:${day}`);
    },
    async merchReserve(m, itemId, key, code) {
      const prior = reservations.find((r) => r.member_id === m && (r as Reservation & { key?: string }).key === key);
      if (prior) return { reservation_id: prior.id, gems_balance: gems.get(m) ?? 0, replayed: true };
      const it = items.find((i) => i.id === itemId);
      if (!it || it.category !== "merch" || !it.active || it.price_gems === null) throw new EconomyError("not_for_sale");
      if (it.stock !== null && it.stock < 1) throw new EconomyError("sold_out");
      if (reservations.filter((r) => r.member_id === m && r.status === "reserved").length >= SETTINGS.max_open_merch) throw new EconomyError("too_many_open");
      const r = apply(m, "gems", -it.price_gems, "merch", it.slug, `merch:${key}`);
      if (it.stock !== null) it.stock -= 1;
      const res: Reservation & { key: string } = { id: `00000000-0000-4000-8000-00000000f${String(++seq).padStart(3, "0")}`, member_id: m, item_id: it.id, item_name: it.display_name, gems: it.price_gems, status: "reserved", pickup_code: code, note: null, created_at: clock().toISOString(), resolved_at: null, key };
      reservations.push(res);
      return { reservation_id: res.id, gems_balance: r.balance, replayed: false };
    },
    async reservations(f) {
      return reservations.filter((r) => (!f.memberId || r.member_id === f.memberId) && (!f.status || r.status === f.status)).map((r) => ({ ...r, member_name: names.get(r.member_id) ?? "Member" }));
    },
    async merchResolve(id, actor, action, note) {
      if (![1, 2].includes(tiers.get(actor) ?? 5)) throw new EconomyError("forbidden");
      const r = reservations.find((x) => x.id === id);
      if (!r) throw new EconomyError("not_found");
      const target = action === "fulfil" ? "fulfilled" : "cancelled";
      if (r.status === target) return { status: target, replayed: true };
      if (r.status !== "reserved") throw new EconomyError("already_resolved");
      if (target === "cancelled") {
        apply(r.member_id, "gems", r.gems, "refund", "merch refund", `merch_refund:${r.id}`);
        const it = items.find((i) => i.id === r.item_id)!;
        if (it.stock !== null) it.stock += 1;
      }
      r.status = target;
      r.note = note;
      r.resolved_at = clock().toISOString();
      return { status: target, replayed: false };
    },
    async credit(m, currency, amount, source, ref, key) {
      return apply(m, currency, amount, source, ref, key);
    },
  };
  return {
    store, items, ledger,
    fund: (m: string, c: number, g = 0) => { coins.set(m, c); gems.set(m, g); },
    give: (m: string, key: string, n: number) => collections.set(`${m}:${key}`, (collections.get(`${m}:${key}`) ?? 0) + n),
    setTier: (m: string, t: number) => tiers.set(m, t),
    name: (m: string, n: string) => names.set(m, n),
    coinsOf: (m: string) => coins.get(m) ?? 0,
    gemsOf: (m: string) => gems.get(m) ?? 0,
    prices: SELL_PRICES,
  };
}
