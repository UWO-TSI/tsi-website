"use client";

/**
 * The shop's counter (specs/polish/forage-craft-museum.md 9): E at the counter in the shop opens it, with the
 * shopkeeper serving you from behind it (ShopInterior's resident). Buy is the shop's shelves with every item's own art
 * (ShopBody); Sell takes what's in your bag over the counter, one or the stack, never a locked favourite. The till at
 * the top counts the coins up (or down) in a few clinks, and the shopkeeper says a word about each sale. Coins and
 * Gems only, one price an item, never money (lib/economy.ts).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, ShoppingBasket } from "lucide-react";
import { Badge, Button, Empty, ErrorNote, List, ListRow, Loading, Tabs } from "@/components/gui";
import { Amount, CurrencyIcon } from "@/components/economy/Amount";
import { ShopBody } from "@/components/economy/EconomySheets";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import type { SellEntry } from "@/lib/wallet/service";
import { coinSteps, sellAtCounter } from "@/lib/game/shopCounter";
import { loadBag } from "@/lib/game/bagStore";
import { AudioManager } from "@/lib/game/audio";
import { iconUrl } from "@/lib/icons/keys";
import IslandSheet from "./IslandSheet";
import styles from "./ShopCounter.module.css";

/** The shopkeeper's word on it, said behind the counter (ShopInterior's Keeper listens). */
const say = (line: string, clip: "Wave" | "Chat" = "Chat") => window.dispatchEvent(new CustomEvent("tsi:shopkeeper-say", { detail: { line, clip } }));

/** Module scope (written straight to the DOM, not React: a few clinks): the till counting from one balance to another. */
function countUp(el: HTMLElement | null, coin: HTMLElement | null, from: number, to: number, timers: number[]) {
  if (!el) return;
  timers.forEach(window.clearTimeout);
  timers.length = 0;
  el.textContent = from.toLocaleString();
  coinSteps(from, to).forEach(({ value, at }, i, all) => timers.push(window.setTimeout(() => {
    el.textContent = value.toLocaleString();
    coin?.classList.remove(styles.clink); void coin?.offsetWidth; coin?.classList.add(styles.clink);
    // A coin's clink (the click, high and bright, rising), the last one fuller.
    AudioManager.playSFX("click", { rate: 1.65 + i * 0.05, gain: i === all.length - 1 ? 0.5 : 0.3 });
  }, at)));
}

function SellList({ transport, onSold }: { transport: EconomyTransport; onSold: (from: number, to: number) => void }) {
  const [rows, setRows] = useState<SellEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => transport.sellable().then(r => { setRows(r); setError(null); }, () => setError("The shop's books didn't open. Try again.")), [transport]);
  useEffect(() => { void load(); }, [load]);
  const sell = async (e: SellEntry, qty: number) => {
    setBusy(e.item_key);
    const r = await sellAtCounter(transport, e, qty);
    say(r.line, r.ok ? "Wave" : "Chat");
    if (r.ok) { onSold(r.from, r.to); void loadBag(); } else setError(r.error);
    await load();
    setBusy(null);
  };
  if (!rows) return error ? <ErrorNote onRetry={() => void load()}>{error}</ErrorNote> : <Loading label="Counting your pockets…" />;
  return <div>
    <p className={styles.lead}>Prices go by rarity. Donate your first of each species to the museum before you sell it. What you&apos;ve locked in your bag stays there.</p>
    {error && <ErrorNote>{error}</ErrorNote>}
    {rows.length === 0 ? <Empty icon={<ShoppingBasket size={32} />} title="Nothing to sell yet">Go fishing, bug hunting or foraging, then come back.</Empty>
      : <List label="What the shop will buy">{rows.map(e => <ListRow key={e.item_key} icon={iconUrl(e.item_key)} title={<>{e.name} <span className={styles.count}>×{e.count}</span></>}
        detail={<span className={styles.detail}>{e.rarity} {e.category} · <Amount n={e.price_each} /> each</span>}
        value={e.locked ? <Badge tone="warn"><Lock size={12} aria-hidden /> Locked</Badge> : <span className={styles.actions}>
          <Button size="sm" variant="quiet" disabled={busy !== null} onClick={() => void sell(e, 1)}>Sell 1</Button>
          {e.count > 1 && <Button size="sm" disabled={busy !== null} onClick={() => void sell(e, e.count)}>All · <Amount n={e.price_each * e.count} /></Button>}
        </span>} />)}</List>}
  </div>;
}

export default function ShopCounter({ open, onClose, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; transport?: EconomyTransport }) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [coins, setCoins] = useState<number | null>(null);
  const till = useRef<HTMLSpanElement>(null), coin = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    transport.wallet().then(w => { if (alive) setCoins(w.coins); }, () => {});
    return () => { alive = false; };
  }, [open, transport]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const counted = (from: number, to: number) => countUp(till.current, coin.current, from, to, timers.current);
  return <IslandSheet open={open} title="The counter" onClose={onClose} testId="shop-counter" keys="e" size="lg">
    <div className={styles.top}>
      <p className={styles.till} aria-live="polite"><span ref={coin} className={styles.coin}><CurrencyIcon size={26} /></span>
        <span ref={till} className={styles.tillValue}>{coins === null ? "…" : coins.toLocaleString()}</span><span className={styles.unit}>coins</span></p>
      <Tabs label="At the counter" value={tab} onChange={setTab} tabs={[{ id: "buy", label: "Buy" }, { id: "sell", label: "Sell" }]} />
    </div>
    {tab === "buy"
      ? <ShopBody transport={transport} hideBalances onBought={(e, r) => { if (r.currency === "coins") counted(r.balance + r.price_each, r.balance); say(`The ${e.name.toLowerCase()}, all yours. Thanks for stopping by!`, "Wave"); }} />
      : <SellList transport={transport} onSold={counted} />}
  </IslandSheet>;
}
