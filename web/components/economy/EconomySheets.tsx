"use client";

/**
 * Shop / Sell / Inventory / Wallet sheets (specs/economy.md deliverable 4),
 * in the same overlay pattern as the progression sheets. Amounts are shown
 * as play coins or Gems only (their icons, components/economy/Amount); nothing is ever expressed as money.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, Backpack, BookOpen, Briefcase, CalendarCheck, Check, Coins, Fish, Flag, Gift, Hammer, HandHeart, House, Lock, ReceiptText, ScrollText, Shirt, ShoppingBag,
  ShoppingBasket, Sparkles, Store, Swords, Target, Undo2, Wallet as WalletIcon, type LucideIcon } from "lucide-react";
import { COINS, GEMS } from "@/lib/economy";
import { iconUrl, shopIcon } from "@/lib/icons/keys";
import { Badge, Button, Empty, ErrorNote, List, ListRow, Loading, SignInLink, SignInText, Tabs } from "@/components/gui";
import { AudioManager } from "@/lib/game/audio";
import { markGiftClaimed } from "@/lib/game/hudStore";
import { walletSheet, type WalletKind } from "@/lib/wallet/walletSheet";
import { Amount, CurrencyIcon } from "./Amount";
import { ownedCounts } from "@/lib/wallet/rules";
import type { InventoryView, SellEntry, ShopEntry, ShopView, WalletView } from "@/lib/wallet/service";
import { ApiError, newKey } from "@/lib/apiClient";
import { httpEconomyTransport, type EconomyTransport, type MerchView } from "@/lib/wallet/transport";
import ProgressionPanel, { type ProgressionSheetProps } from "@/components/progression/ProgressionPanel";
import p from "@/components/progression/progression.module.css";
import s from "./economy.module.css";

const fmt = (n: number, c: string) => <Amount n={n} currency={c} />;
// Signed out (the session ran out mid-visit): said as a sign-in, whose words link back here (reachability §3).
const errText = (err: unknown) => (err instanceof ApiError ? (err.status === 401 ? "Sign in first." : err.message) : "Couldn't reach the shop. Try again.");

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

  if (!data) return error ? <ErrorNote onRetry={() => void reload()}><SignInText text={error} /></ErrorNote> : <Loading label="Opening the shop…" />;
  const list = data.tabs[tab];
  return (
    <div>
      <Balances coins={data.coins} gems={data.gems} />
      <Tabs label="Shop sections" value={tab} onChange={setTab} className={s.tabs}
        tabs={TABS.map(([k, label]) => ({ id: k, label, badge: k === "specials" ? data.tabs.specials.length : undefined }))} />
      {tab === "specials" ? <p className={p.muted} style={{ marginBottom: 8 }}>20% off today. New picks at midnight (Toronto time).</p> : null}
      {tab === "merch" ? <p className={p.muted} style={{ marginBottom: 8 }}>Real TSI merch for Gems. Reserve here, then pick it up at HQ on campus.</p> : null}
      {note ? <p role="status" className={`${p.note} ${p.ok}`}>{note}</p> : null}
      {error ? <ErrorNote><SignInText text={error} /></ErrorNote> : null}
      {list.length === 0 ? <Empty icon={<Store size={32} />} title={tab === "specials" ? "No specials today" : tab === "merch" ? "No merch in stock" : "Nothing on this shelf yet"}>
        {tab === "specials" ? "New picks go up at midnight, Toronto time." : tab === "merch" ? "New club merch arrives with the next order." : "The shopkeeper restocks with each update."}
      </Empty> : null}
      <div className={s.grid}>
        {list.map((e) => (
          <article key={e.id} className={s.tile} aria-label={e.name}>
            {e.special ? <span className={s.sale}>−20%</span> : null}
            {/* Every item's rendered icon (row 281): its sprite_url, or the same icon worked out here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className={s.art} aria-hidden><img src={e.sprite_url ?? shopIcon({ slug: e.slug, catalogue_ref: e.catalogue_ref, category: e.category })} alt="" width={56} height={56} /></div>
            <h4>{e.name}</h4>
            <Badge tone={e.tier === "premium" ? "gold" : "neutral"} className={s.chip}>{e.tier ?? e.category}</Badge>
            <span className={s.price}>
              {fmt(e.price, e.currency)}
              {e.special ? <span className={s.was}>{e.base_price.toLocaleString()}</span> : null}
            </span>
            {e.stock !== null ? (e.stock > 0 ? <span className={p.muted}>{e.stock} left</span> : <Badge tone="danger">Sold out</Badge>) : null}
            {e.owned > 0 ? <span className={p.muted}>You own {e.owned}</span> : null}
            <Button size="sm" className={s.buy} variant={e.owned > 0 && !e.can_buy ? "quiet" : "primary"} disabled={!e.can_buy || busy !== null} onClick={() => act(e)}>
              {busy === e.id ? "One moment…" : e.category === "merch" ? "Reserve" : e.owned > 0 && e.can_buy ? "Buy another" : e.owned > 0 ? "Owned" : "Buy"}
            </Button>
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
  if (!data) return error ? <ErrorNote onRetry={() => void reload()}><SignInText text={error} /></ErrorNote> : <Loading label="Counting your pockets…" />;
  return (
    <div>
      <p className={p.muted} style={{ marginBottom: 10 }}>Prices go by rarity. Donate your first of each species to the museum before selling it. Things you locked in your bag stay put.</p>
      {earned > 0 ? <p role="status" className={`${p.note} ${p.ok}`}>+{fmt(earned, "coins")} this visit</p> : null}
      {error ? <ErrorNote><SignInText text={error} /></ErrorNote> : null}
      {data.length === 0 ? <Empty icon={<ShoppingBasket size={32} />} title="Nothing to sell yet">Go fishing, bug hunting or foraging, then come back.</Empty> : null}
      <ul className={s.list}>
        {data.map((e) => (
          <li key={e.item_key} className={s.row} data-icon>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={s.rowIcon} src={iconUrl(e.item_key)} alt="" width={36} height={36} />
            <span>
              <b>{e.name}</b> ×{e.count}
              <span className={p.muted} style={{ display: "block" }}>{e.rarity} {e.category} · {fmt(e.price_each, "coins")} each</span>
            </span>
            {/* A favourite locked in the bag (specs/game-ui.md §7): listed, never sold. */}
            {e.locked ? <Badge tone="warn"><Lock size={12} aria-hidden /> Locked in your bag</Badge> : <span className={s.rowActions}>
              <Button size="sm" variant="quiet" disabled={busy !== null} onClick={() => sellIt(e, 1)}>Sell 1</Button>
              <Button size="sm" disabled={busy !== null} onClick={() => sellIt(e, e.count)}>Sell all · {fmt(e.price_each * e.count, "coins")}</Button>
            </span>}
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
  if (!data) return error ? <ErrorNote onRetry={() => void reload()}><SignInText text={error} /></ErrorNote> : <Loading label="Opening your bag…" />;
  const groups = Object.entries(data.groups);
  return (
    <div>
      {error ? <ErrorNote><SignInText text={error} /></ErrorNote> : null}
      {groups.length === 0 ? <Empty icon={<Backpack size={32} />} title="Your bag is empty">The shop is by the plaza.</Empty> : null}
      {groups.map(([g, rows]) => (
        <section key={g} style={{ marginBottom: 12 }}>
          <div className={p.eyebrow}>{GROUP_LABEL[g] ?? g}</div>
          <ul className={s.list}>
            {rows.map((r) => (
              <li key={r.item.id} className={s.row} data-icon>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={s.rowIcon} src={r.item.sprite_url ?? shopIcon(r.item)} alt="" width={36} height={36} />
                <span>
                  <b>{r.item.display_name}</b>
                  {r.qty > 1 ? ` ×${r.qty}` : ""}
                  {r.item.slot ? <span className={p.muted} style={{ display: "block" }}>{r.item.slot}</span> : null}
                </span>
                {r.equipped ? <Badge tone="sage">Equipped</Badge> : <span />}
                {r.item.slot ? (
                  <Button size="sm" variant={r.equipped ? "quiet" : "primary"} onClick={() => toggle(r.item.id, !r.equipped)}>{r.equipped ? "Unequip" : "Equip"}</Button>
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

const KIND_ICON: Record<WalletKind, LucideIcon> = {
  sell: Fish, shop: ShoppingBag, gift: Gift, study: BookOpen, chapter: Flag, quest: ScrollText, event: CalendarCheck, grant: HandHeart, room: House,
  goal: Target, refund: Undo2, carry: ArrowRightLeft, merch: Shirt, path: Sparkles, mission: Swords, repair: Hammer, bounty: Briefcase, other: Coins,
};
/** The time, re-read twice a minute while the wallet is open (the gift's countdown). */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/**
 * The wallet (specs/polish/reachability.md deliverable 2; K in the game, the portal's Wallet page): the TC balance on
 * its own card, Gems beside it, today's gift (open it here, or when the next one comes), and what you've earned and
 * spent lately, by day, each move said plainly with its own icon (lib/wallet/walletSheet.ts). TC and Gems only: never
 * money, never a rate between them.
 */
export function WalletBody({ transport = httpEconomyTransport }: { transport?: EconomyTransport }) {
  const load = useCallback(() => transport.wallet(), [transport]);
  const { data, error, reload, setError } = useLoad<WalletView>(load);
  const [tab, setTab] = useState<"earned" | "spent">("earned");
  const [gift, setGift] = useState<{ busy: boolean; got: number | null }>({ busy: false, got: null });
  const now = useMinute();
  const model = useMemo(() => (data ? walletSheet(data, now) : null), [data, now]);
  const claim = async () => {
    setGift({ busy: true, got: null });
    AudioManager.playSFX("click");
    try {
      const r = await transport.dailyGift();
      // The HUD's coins count it in and today's pop-up stands down.
      markGiftClaimed(r.balance, r.day);
      setGift({ busy: false, got: r.claimed ? r.coins : null });
      if (r.claimed) { AudioManager.playSFX("confirm"); window.setTimeout(() => AudioManager.playSFX("blip2", { rate: 1.5, gain: 0.6 }), 260); }
      await reload();
    } catch (err) {
      setGift({ busy: false, got: null });
      setError(errText(err));
    }
  };
  if (!model) return error ? signedOut(error)
    ? <Empty icon={<WalletIcon size={32} />} title="Sign in to see your wallet" action={<SignInLink button />}>Your TC, your Gems and today&apos;s gift live here.</Empty>
    : <ErrorNote onRetry={() => void reload()}><SignInText text={error} /></ErrorNote> : <Loading label="Opening your wallet…" />;
  const days = tab === "earned" ? model.earned : model.spent;
  return (
    <div className={s.wallet}>
      <div className={s.purse} aria-label={`${model.coins.toLocaleString()} ${COINS.name}`}>
        <span className={s.purseCoin} aria-hidden><CurrencyIcon size={46} /></span>
        <div className={s.purseText} aria-hidden>
          <span className={p.eyebrow}>{COINS.name}</span>
          <b>{model.coins.toLocaleString()}</b>
          <span className={p.muted}>Earned on the island. Spent at the shop, on rooms and on club goals.</span>
        </div>
      </div>
      <div className={s.gems}>
        <CurrencyIcon currency="gems" size={24} />
        <b>{model.gems.toLocaleString()}</b> {GEMS.name}
        <span className={p.muted}>From club contributions, for the merch corner</span>
      </div>
      {model.gift.opened
        ? <div className={s.gift} data-opened="">
          <span className={s.giftIcon} aria-hidden><Check size={20} strokeWidth={3} /></span>
          <span><b>{gift.got ? `+${gift.got.toLocaleString()} ${COINS.name}, today's gift` : "Today's gift is opened"}</b><span className={p.muted}>The next one comes in {model.gift.next}.</span></span>
        </div>
        : <div className={s.gift}>
          <span className={s.giftIcon} aria-hidden><Gift size={22} /></span>
          <span><b>Today&apos;s gift is waiting</b><span className={p.muted}>Everyone on the island gets a little something each day.</span></span>
          <Button size="sm" onClick={() => void claim()} disabled={gift.busy}>{gift.busy ? "Opening…" : "Open it"}</Button>
        </div>}
      {error ? <ErrorNote><SignInText text={signedOut(error) ? "Sign in to open your gift." : error} /></ErrorNote> : null}
      <Tabs label="Recent moves" value={tab} onChange={setTab} className={s.walletTabs}
        tabs={[{ id: "earned", label: <>Earned <span className={s.tabTotal}>+{model.totals.earned.toLocaleString()}</span></> }, { id: "spent", label: <>Spent <span className={s.tabTotal}>−{model.totals.spent.toLocaleString()}</span></> }]} />
      {days.length === 0 ? <Empty icon={<ReceiptText size={32} />} title={tab === "earned" ? "Nothing earned yet" : "Nothing spent yet"}>
        {tab === "earned" ? "Sell a catch at the shop, study at the café or check in at a club event." : "The shop, a new room and the club goals take TC."}
      </Empty> : days.map(d => <section key={d.label} className={s.day} aria-label={d.label}>
        <h3>{d.label}</h3>
        <List label={d.label}>{d.lines.map(l => {
          const Icon = KIND_ICON[l.kind];
          return <ListRow key={l.key} icon={l.icon ?? <Icon size={22} />} title={l.title} detail={l.detail} leader
            value={<span className={l.amount > 0 ? s.plus : s.minus}>{l.amount > 0 ? "+" : "−"}{fmt(Math.abs(l.amount), l.currency)}</span>} />;
        })}</List>
      </section>)}
      <p className={p.muted} style={{ marginTop: 12 }}>{COINS.name} and Gems can&apos;t be traded between members or bought.</p>
    </div>
  );
}
const signedOut = (message: string) => message === "Sign in first.";

type SheetProps = ProgressionSheetProps & { transport?: EconomyTransport; keys?: string };
export const SellSheet = ({ open, onClose, transport }: SheetProps) => <ProgressionPanel open={open} onClose={onClose} title="Sell"><SellBody transport={transport} /></ProgressionPanel>;
/** The Bag (items you own); `keys`: the bag key, which closes it too. */
export const InventorySheet = ({ open, onClose, transport, keys }: SheetProps) => <ProgressionPanel open={open} onClose={onClose} title="Bag" keys={keys}><InventoryBody transport={transport} /></ProgressionPanel>;
/** The wallet; `keys`: the wallet key, which closes it too. */
export const WalletSheet = ({ open, onClose, transport, keys }: SheetProps) => <ProgressionPanel open={open} onClose={onClose} title="Wallet" keys={keys}><WalletBody transport={transport} /></ProgressionPanel>;
