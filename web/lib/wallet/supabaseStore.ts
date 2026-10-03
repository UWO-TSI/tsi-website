import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopItem } from "./rules";
import { raisePg } from "@/lib/result";
import { EconomyError, type EconomyErrorCode, type EconomyStore, type LedgerEntry, type Reservation } from "./store";

type Row = Record<string, unknown>;
const CODES: EconomyErrorCode[] = ["insufficient", "not_found", "not_for_sale", "already_owned", "bad_qty", "bad_price", "sold_out", "not_sellable", "insufficient_items", "too_many_open", "already_resolved", "forbidden", "locked"];
const raise = (error: { code?: string; message?: string } | null): never => raisePg(error, CODES);
const first = (data: unknown) => ((Array.isArray(data) ? data[0] : data) ?? {}) as Row;
const ITEM_COLS = "id, slug, display_name, category, description, price_coins, tc_price, tier, slot, special_pool, stackable, stock, catalogue_ref, sprite_url, position, active, available_from, available_until, retired_at";
const toItem = (r: Row): ShopItem => ({
  id: String(r.id), slug: String(r.slug), display_name: String(r.display_name), category: String(r.category), description: String(r.description ?? ""),
  price_coins: r.price_coins === null || r.price_coins === undefined ? null : Number(r.price_coins), price_gems: r.tc_price === null || r.tc_price === undefined ? null : Number(r.tc_price),
  tier: (r.tier as ShopItem["tier"]) ?? null, slot: (r.slot as ShopItem["slot"]) ?? null, special_pool: r.special_pool === true, stackable: r.stackable === true,
  stock: r.stock === null || r.stock === undefined ? null : Number(r.stock), catalogue_ref: (r.catalogue_ref as string) ?? null, sprite_url: (r.sprite_url as string) ?? null,
  position: Number(r.position ?? 0), active: r.active !== false && !r.retired_at, available_from: (r.available_from as string) ?? null, available_until: (r.available_until as string) ?? null,
});

export function supabaseEconomyStore(db: SupabaseClient): EconomyStore {
  const names = async (ids: string[]) => {
    const out = new Map<string, string>();
    if (!ids.length) return out;
    const { data } = await db.from("profiles").select("id, display_name").in("id", ids);
    for (const p of (data ?? []) as Row[]) out.set(String(p.id), String(p.display_name ?? "Member"));
    return out;
  };
  return {
    async wallet(m) {
      const [w, p] = await Promise.all([db.from("wallets").select("coins").eq("member_id", m).maybeSingle(), db.from("profiles").select("tethos_coins").eq("id", m).maybeSingle()]);
      if (w.error) raise(w.error);
      if (p.error) raise(p.error);
      return { coins: Number((w.data as Row | null)?.coins ?? 0), gems: Number((p.data as Row | null)?.tethos_coins ?? 0) };
    },
    async ledger(m, limit) {
      const [c, g] = await Promise.all([
        db.from("wallet_ledger").select("amount, balance_after, source, ref, created_at").eq("member_id", m).order("created_at", { ascending: false }).limit(limit),
        db.from("tc_transactions").select("amount, balance_after, type, description, created_at").eq("user_id", m).order("created_at", { ascending: false }).limit(limit),
      ]);
      if (c.error) raise(c.error);
      const coins = ((c.data ?? []) as Row[]).map((r): LedgerEntry => ({ currency: "coins", amount: Number(r.amount), balance_after: Number(r.balance_after), source: String(r.source), ref: (r.ref as string) ?? null, created_at: String(r.created_at) }));
      const gems = ((g.data ?? []) as Row[]).map((r): LedgerEntry => ({ currency: "gems", amount: Number(r.amount), balance_after: Number(r.balance_after), source: String(r.type), ref: (r.description as string) ?? null, created_at: String(r.created_at) }));
      return [...coins, ...gems].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    },
    async catalogue() {
      const { data, error } = await db.from("shop_items").select(ITEM_COLS).eq("active", true).order("position");
      if (error) raise(error);
      return ((data ?? []) as Row[]).map(toItem);
    },
    async inventory(m) {
      const { data, error } = await db.from("member_inventory").select(`qty, equipped, acquired_at, shop_items(${ITEM_COLS})`).eq("member_id", m);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map((r) => ({ item: toItem(r.shop_items as Row), qty: Number(r.qty), equipped: r.equipped === true, acquired_at: String(r.acquired_at) }));
    },
    async grantStarters(m) {
      const { data, error } = await db.rpc("economy_grant_starters", { p_member_id: m });
      if (error) raise(error);
      return { granted: first(data).granted === true };
    },
    async buy(m, itemId, qty, price, key) {
      const { data, error } = await db.rpc("economy_buy", { p_member_id: m, p_item_id: itemId, p_qty: qty, p_price_each: price, p_idempotency_key: key });
      if (error) raise(error);
      const r = first(data);
      return { balance: Number(r.balance), owned: Number(r.owned), replayed: r.replayed === true };
    },
    async collections(m) {
      const { data, error } = await db.from("member_collections").select("item_key, count, locked").eq("user_id", m).gt("count", 0);
      if (error) raise(error);
      return ((data ?? []) as Row[]).map((r) => ({ item_key: String(r.item_key), count: Number(r.count), locked: r.locked === true }));
    },
    async sell(m, key, qty, idem) {
      const { data, error } = await db.rpc("economy_sell", { p_member_id: m, p_item_key: key, p_qty: qty, p_idempotency_key: idem });
      if (error) raise(error);
      const r = first(data);
      return { balance: Number(r.balance), remaining: Number(r.remaining), paid: Number(r.paid), replayed: r.replayed === true };
    },
    async setEquipped(m, itemId, equipped) {
      const { data: row, error } = await db.from("member_inventory").select("slot").eq("member_id", m).eq("item_id", itemId).maybeSingle();
      if (error) raise(error);
      if (!row) throw new EconomyError("not_owned");
      const slot = (row as Row).slot as string | null;
      if (!slot) throw new EconomyError("no_slot");
      if (equipped) {
        const off = await db.from("member_inventory").update({ equipped: false }).eq("member_id", m).eq("slot", slot).eq("equipped", true);
        if (off.error) raise(off.error);
      }
      const on = await db.from("member_inventory").update({ equipped }).eq("member_id", m).eq("item_id", itemId);
      if (on.error) raise(on.error);
    },
    async dailyGift(m) {
      const { data, error } = await db.rpc("daily_gift_claim", { p_member_id: m });
      if (error) raise(error);
      const r = first(data);
      return { coins: Number(r.coins), balance: Number(r.balance), claimed: r.claimed === true, day: String(r.day) };
    },
    async dailyClaimed(m, day) {
      const { data, error } = await db.from("daily_login_claims").select("day").eq("member_id", m).eq("day", day).maybeSingle();
      if (error) raise(error);
      return !!data;
    },
    async merchReserve(m, itemId, key, code) {
      const { data, error } = await db.rpc("merch_reserve", { p_member_id: m, p_item_id: itemId, p_idempotency_key: key, p_pickup_code: code });
      if (error) raise(error);
      const r = first(data);
      return { reservation_id: String(r.reservation_id), gems_balance: Number(r.gems_balance), replayed: r.replayed === true };
    },
    async reservations(f) {
      let q = db.from("merch_reservations").select("id, member_id, item_id, gems, status, pickup_code, note, created_at, resolved_at, shop_items(display_name)").order("created_at", { ascending: false }).limit(200);
      if (f.memberId) q = q.eq("member_id", f.memberId);
      if (f.status) q = q.eq("status", f.status);
      const { data, error } = await q;
      if (error) raise(error);
      const rows = (data ?? []) as Row[];
      const n = await names([...new Set(rows.map((r) => String(r.member_id)))]);
      return rows.map((r): Reservation => ({
        id: String(r.id), member_id: String(r.member_id), member_name: n.get(String(r.member_id)) ?? "Member", item_id: String(r.item_id),
        item_name: String((r.shop_items as Row | null)?.display_name ?? "Merch"), gems: Number(r.gems), status: r.status as Reservation["status"],
        pickup_code: String(r.pickup_code), note: (r.note as string) ?? null, created_at: String(r.created_at), resolved_at: (r.resolved_at as string) ?? null,
      }));
    },
    async merchResolve(id, actor, action, note) {
      const { data, error } = await db.rpc("merch_resolve", { p_reservation_id: id, p_actor_id: actor, p_action: action, p_note: note });
      if (error) raise(error);
      const r = first(data);
      return { status: String(r.status), replayed: r.replayed === true };
    },
    async credit(m, currency, amount, source, ref, key) {
      const { data, error } = await db.rpc("wallet_apply", { p_member_id: m, p_currency: currency, p_amount: amount, p_source: source, p_ref: ref, p_idempotency_key: key });
      if (error) raise(error);
      const r = first(data);
      return { balance: Number(r.balance), replayed: r.replayed === true };
    },
  };
}
