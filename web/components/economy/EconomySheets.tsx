"use client";

/**
 * Shop / Sell / Inventory / Wallet sheets (specs/economy.md deliverable 4),
 * in the same overlay pattern as the progression sheets. Amounts are shown
 * as play coins 🪙 or Gems 💎 only; nothing is ever expressed as money.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtCoins, fmtGems } from "@/lib/economy";
import { ownedCounts } from "@/lib/wallet/rules";
import type { InventoryView, SellEntry, ShopEntry, ShopView, WalletView } from "@/lib/wallet/service";
import { ApiError, newKey } from "@/lib/apiClient";
import { httpEconomyTransport, type EconomyTransport, type MerchView } from "@/lib/wallet/transport";
import ProgressionPanel, { type ProgressionSheetProps } from "@/components/progression/ProgressionPanel";
import p from "@/components/progression/progression.module.css";
import s from "./economy.module.css";

const fmt = (n: number, c: string) => (c === "gems" ? fmtGems(n) : fmtCoins(n));
const ART: Record<string, string> = { tool: "🎣", outfit: "👕", hair: "💇", accessory: "🎩", furniture: "🛋️", wallpaper: "🖼️", flooring: "🟫", merch: "🛍️" };
const errText = (err: unknown) => (err instanceof ApiError ? err.message : "Couldn't reach the shop. Try again.");

function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const d = await load();
      setData(d);
      setError(null);
    } catch (err) {
      setError(errText(err));
    }
  }, [load]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void reload();
  }, [reload]);
  return { data, error, reload, setError };
}

/** What the player owns by catalogue ref (clothes, dyes, furniture, finishes) → qty; null until loaded or when signed out. */
export function useOwned(transport = httpEconomyTransport): Map<string, number> | null {
  const load = useCallback(() => transport.inventory(), [transport]);
  const { data } = useLoad<InventoryView>(load);
  return useMemo(() => (data ? ownedCounts(Object.values(data.groups).flat()) : null), [data]);
}

function Balances({ coins, gems }: { coins: number; gems: number }) {
  return (
    <div className={s.balances} aria-label="Your wallet">
      <span className={s.balance}>{fmt(coins, "coins")}</span>
      <span className={s.balance}>{fmt(gems, "gems")}</span>
    </div>
  );
}

// ── Shop ─────────────────────────────────────────────────────────────────────

const TABS = [["tools", "Tools"], ["outfits", "Outfits"], ["furniture", "Furniture"], ["specials", "Today's specials"], ["merch", "Merch"]] as const;

export function ShopBody({ transport = httpEconomyTransport, initialTab = "tools" }: { transport?: EconomyTransport; initialTab?: (typeof TABS)[number][0] }) {
  const load = useCallback(() => transport.shop(), [transport]);
  const { data, error, reload, setError } = useLoad<ShopView>(load);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>(initialTab);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const keys = useRef(new Map<string, string>());

  const act = async (e: ShopEntry) => {
    setBusy(e.id);
    setNote(null);
    const key = keys.current.get(e.id) ?? newKey();
    keys.current.set(e.id, key); // same key if this click is retried
    try {
      if (e.currency === "gems" && e.category === "merch") {
        const r = await transport.reserve(e.id, key);
        setNote(`Reserved ${e.name}. Show pickup code ${r.reservation?.pickup_code ?? ""} at HQ on campus.`);
      } else {
        await transport.buy(e.id, 1, key);
        setNote(`Bought ${e.name}.`);
      }
      keys.current.delete(e.id);
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) keys.current.delete(e.id);
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <p className={p.empty}>{error ?? "Opening the shop…"}</p>;
  const list = data.tabs[tab];
  return (
    <div>
      <Balances coins={data.coins} gems={data.gems} />
      <div className={p.tabs} role="tablist" aria-label="Shop sections" style={{ flexWrap: "wrap" }}>
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={p.tab} onClick={() => setTab(k)}>
            {label}
            {k === "specials" ? <span className={p.badge}>{data.tabs.specials.length}</span> : null}
          </button>
        ))}
      </div>
      {tab === "specials" ? <p className={p.muted} style={{ marginBottom: 8 }}>20% off today. New picks at midnight (Toronto time).</p> : null}
      {tab === "merch" ? <p className={p.muted} style={{ marginBottom: 8 }}>Real TSI merch for Gems. Reserve here, then pick it up at HQ on campus.</p> : null}
      {note ? <p role="status" className={`${p.note} ${p.ok}`}>{note}</p> : null}
      {error ? <p role="alert" className={`${p.note} ${p.err}`}>{error}</p> : null}
      <div className={s.grid}>
        {list.map((e) => (
          <article key={e.id} className={s.tile} aria-label={e.name}>
            {e.special ? <span className={s.sale}>−20%</span> : null}
            <div className={s.art} aria-hidden>{ART[e.category] ?? "✨"}</div>
            <h4>{e.name}</h4>
            {e.tier ? <span className={s.chip}>{e.tier}</span> : <span className={s.chip}>{e.category}</span>}
            <span className={s.price}>
              {fmt(e.price, e.currency)}
              {e.special ? <span className={s.was}>{e.base_price.toLocaleString()}</span> : null}
            </span>
            {e.stock !== null ? <span className={p.muted}>{e.stock > 0 ? `${e.stock} left` : "Sold out"}</span> : null}
            {e.owned > 0 ? <span className={p.muted}>You own {e.owned}</span> : null}
            <button className={`${p.btn} ${s.small}`} disabled={!e.can_buy || busy !== null} onClick={() => act(e)}>
              {busy === e.id ? "…" : e.category === "merch" ? "Reserve" : e.owned > 0 && e.can_buy ? "Buy another" : e.owned > 0 ? "Owned" : "Buy"}
            </button>
          </article>
        ))}
      </div>
      {tab === "merch" ? <MerchPickups transport={transport} /> : null}
    </div>
  );
}

function MerchPickups({ transport }: { transport: EconomyTransport }) {
  const load = useCallback(() => transport.merch(), [transport]);
  const { data } = useLoad<MerchView>(load);
  const open = data?.reservations.filter((r) => r.status === "reserved") ?? [];
  if (!open.length) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div className={p.eyebrow}>Your pickups</div>
      <ul className={s.list}>
        {open.map((r) => (
          <li key={r.id} className={s.row}>
            <span>{r.item_name}</span>
            <span className={s.code} aria-label="Pickup code">{r.pickup_code}</span>
            <span className={p.muted}>{fmt(r.gems, "gems")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Sell ─────────────────────────────────────────────────────────────────────

export function SellBody({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const load = useCallback(() => transport.sellable(), [transport]);
  const { data, error, reload, setError } = useLoad<SellEntry[]>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const [earned, setEarned] = useState(0);
  const sellIt = async (e: SellEntry, qty: number) => {
    setBusy(e.item_key);
    try {
      const r = await transport.sell(e.item_key, qty, newKey());
      setEarned((x) => x + r.paid);
      await reload();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  };
  if (!data) return <p className={p.empty}>{error ?? "Counting your pockets…"}</p>;
  return (
    <div>
      <p className={p.muted} style={{ marginBottom: 10 }}>Prices go by rarity. Donate your first of each species to the museum before selling it.</p>
      {earned > 0 ? <p role="status" className={`${p.note} ${p.ok}`}>+{fmt(earned, "coins")} this visit</p> : null}
      {error ? <p role="alert" className={`${p.note} ${p.err}`}>{error}</p> : null}
      {data.length === 0 ? <p className={p.empty}>Nothing to sell yet. Go fishing, bug hunting or foraging.</p> : null}
      <ul className={s.list}>
        {data.map((e) => (
          <li key={e.item_key} className={s.row}>
            <span>
              <b>{e.name}</b> ×{e.count}
              <span className={p.muted} style={{ display: "block" }}>{e.rarity} {e.category} · {fmt(e.price_each, "coins")} each</span>
            </span>
            <button className={`${p.ghost} ${s.small}`} disabled={busy !== null} onClick={() => sellIt(e, 1)}>Sell 1</button>
            <button className={`${p.btn} ${s.small}`} disabled={busy !== null} onClick={() => sellIt(e, e.count)}>Sell all · {fmt(e.price_each * e.count, "coins")}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Inventory ────────────────────────────────────────────────────────────────

const GROUP_LABEL: Record<string, string> = { tools: "Tools", outfits: "Outfits & accessories", furniture: "Furniture & finishes" };
const USE_HINT: Record<string, string> = { outfits: "Wear it from your closet", furniture: "Place at home" };

export function InventoryBody({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const load = useCallback(() => transport.inventory(), [transport]);
  const { data, error, reload, setError } = useLoad<InventoryView>(load);
  const toggle = async (id: string, on: boolean) => {
    try {
      await transport.equip(id, on);
      await reload();
    } catch (err) {
      setError(errText(err));
    }
  };
  if (!data) return <p className={p.empty}>{error ?? "Opening your bag…"}</p>;
  const groups = Object.entries(data.groups);
  return (
    <div>
      {error ? <p role="alert" className={`${p.note} ${p.err}`}>{error}</p> : null}
      {groups.length === 0 ? <p className={p.empty}>Your bag is empty. The shop is by the plaza.</p> : null}
      {groups.map(([g, rows]) => (
        <section key={g} style={{ marginBottom: 12 }}>
          <div className={p.eyebrow}>{GROUP_LABEL[g] ?? g}</div>
          <ul className={s.list}>
            {rows.map((r) => (
              <li key={r.item.id} className={s.row}>
                <span>
                  <b>{r.item.display_name}</b>
                  {r.qty > 1 ? ` ×${r.qty}` : ""}
                  {r.item.slot ? <span className={p.muted} style={{ display: "block" }}>{r.item.slot}</span> : null}
                </span>
                {r.equipped ? <span className={s.chip}>Equipped</span> : <span />}
                {r.item.slot ? (
                  <button className={`${r.equipped ? p.ghost : p.btn} ${s.small}`} onClick={() => toggle(r.item.id, !r.equipped)}>{r.equipped ? "Unequip" : "Equip"}</button>
                ) : (
                  <span className={p.muted}>{USE_HINT[g] ?? ""}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ── Wallet ───────────────────────────────────────────────────────────────────

const SOURCE: Record<string, string> = {
  study: "Study session", sell: "Sold at the shop", chapter: "Chapter reward", quest: "Quest reward", daily_gift: "Daily gift", event: "Club event check-in",
  admin: "Club grant", shop: "Shop purchase", room: "New room", goal: "Club goal delivery", refund: "Refund", migration: "Carried over",
  merch: "Merch reservation",
  spend_merch: "Merch reservation", refund_merch: "Merch refund", spend_shop: "Shop purchase", earn_bounty: "Bounty", earn_event: "Club event", earn_admin: "Club grant", earn_quest: "Quest",
};

export function WalletBody({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const load = useCallback(() => transport.wallet(), [transport]);
  const { data, error, reload, setError } = useLoad<WalletView>(load);
  const [gift, setGift] = useState<string | null>(null);
  const claim = async () => {
    try {
      const r = await transport.dailyGift();
      setGift(r.claimed ? `+${fmt(r.coins, "coins")} daily gift` : "Already claimed today. Back tomorrow.");
      await reload();
    } catch (err) {
      setError(errText(err));
    }
  };
  if (!data) return <p className={p.empty}>{error ?? "Opening your wallet…"}</p>;
  return (
    <div>
      <div className={s.big}>
        <div className={s.bigCard}><span className={p.eyebrow}>Play coins</span><b>{fmt(data.coins, "coins")}</b><span className={p.muted}>Shop, rooms, club goals</span></div>
        <div className={s.bigCard}><span className={p.eyebrow}>Gems</span><b>{fmt(data.gems, "gems")}</b><span className={p.muted}>From club contributions · merch corner</span></div>
      </div>
      <div className={p.actions} style={{ marginTop: 0, marginBottom: 12 }}>
        <button className={p.btn} onClick={claim} disabled={data.daily_claimed}>{data.daily_claimed ? "Daily gift claimed" : "Claim daily gift"}</button>
      </div>
      {gift ? <p role="status" className={`${p.note} ${p.ok}`}>{gift}</p> : null}
      {error ? <p role="alert" className={`${p.note} ${p.err}`}>{error}</p> : null}
      <div className={p.eyebrow}>Recent</div>
      {data.recent.length === 0 ? <p className={p.empty}>No activity yet.</p> : null}
      <ul className={s.list}>
        {data.recent.map((e, i) => (
          <li key={i} className={s.row}>
            <span>{SOURCE[e.source] ?? e.source}<span className={p.muted} style={{ display: "block" }}>{new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>
            <span className={e.amount > 0 ? s.plus : s.minus}>{e.amount > 0 ? "+" : ""}{fmt(e.amount, e.currency)}</span>
            <span className={p.muted}>{fmt(e.balance_after, e.currency)}</span>
          </li>
        ))}
      </ul>
      <p className={p.muted} style={{ marginTop: 10 }}>Coins and Gems can&apos;t be traded between members or bought.</p>
    </div>
  );
}

type SheetProps = ProgressionSheetProps & { transport?: EconomyTransport };
export const SellSheet = ({ open, onClose, transport }: SheetProps) => <ProgressionPanel open={open} onClose={onClose} title="Sell"><SellBody transport={transport} /></ProgressionPanel>;
export const InventorySheet = ({ open, onClose, transport }: SheetProps) => <ProgressionPanel open={open} onClose={onClose} title="Bag"><InventoryBody transport={transport} /></ProgressionPanel>;
export const WalletSheet = ({ open, onClose, transport }: SheetProps) => <ProgressionPanel open={open} onClose={onClose} title="Wallet"><WalletBody transport={transport} /></ProgressionPanel>;
