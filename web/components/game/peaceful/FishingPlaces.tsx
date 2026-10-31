"use client";

/**
 * The fishing places on the flat kit (David's review, 2026-10-28: "i need you to fuckign lock in on all the ui"):
 * - the fish market at its stall, three clear places (David: "a place to quick sell, a place to put your fish to monthly
 *   leaderboard and daily /weekly fishing task"): QuickSell, MonthlyBoard and FishingTasks;
 * - the task board out front, the tasks on their own (David: "its not a hand one over, its if you did it you claim it");
 * - the tackle shop's counter, rolls for bait, bobbers and rods (David: "one for coin one for gem, roll for 1 to 10,
 *   seasonal crazy bait and rod"), the odds always in view;
 * - the sushi chef's order by day (David: "REDO THE FUCKING UI"): the fish he wants, what he pays, one action.
 * The server picks, prices and checks everything (lib/wallet/service.ts, lib/collections/service.ts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChefHat, Clock, Coins, Fish, Gem, HandCoins, ListChecks, Lock, Ruler, Soup, Sun, Trophy } from "lucide-react";
import type { MonthBoard } from "@/lib/collections/service";
import type { ChefView, FishingTasksView, SellEntry, TackleView, TaskView, WalletView } from "@/lib/wallet/service";
import { prizeByKey, type Counter, type Pulls } from "@/lib/wallet/tackle";
import { httpEconomyTransport, type EconomyTransport } from "@/lib/wallet/transport";
import { apiCall, newKey } from "@/lib/apiClient";
import { iconUrl } from "@/lib/icons/keys";
import { countUp, sellAtCounter } from "@/lib/game/shopCounter";
import { RARITY_LABEL, type Rarity } from "@/lib/rarity";
import { CurrencyIcon } from "@/components/economy/Amount";
import { errText } from "@/components/economy/EconomySheets";
import { mealText } from "@/components/game/peaceful/SushiSheets";
import {
  DarkButton, FlatDialog, FlatPanel, GachaReveal, GhostButton, IconRail, OddsTable, Purse, HoverTip, Quiet, StatusLine, TaskCard, Thumb, TipBody,
  type OddsRow, type RailItem, type RevealItem,
} from "@/components/gui/flat";
import s from "./places.module.css";

/** Coins (or Gems) as the icon and the number. */
const Money = ({ n, currency = "coins", size = 15 }: { n: number; currency?: string; size?: number }) =>
  <span className={s.money}>{n.toLocaleString()}<CurrencyIcon currency={currency} size={size} /></span>;

/** The purse, counting up or down when it changes (design bible UI 9: animate the change, never jump). */
function useTill(transport: EconomyTransport) {
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const coinsEl = useRef<HTMLSpanElement>(null), gemsEl = useRef<HTMLSpanElement>(null), timers = useRef<number[]>([]);
  useEffect(() => { let live = true; transport.wallet().then(w => { if (live) setWallet(w); }, () => {}); return () => { live = false; }; }, [transport]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const move = useCallback((currency: "coins" | "gems", from: number, to: number) => {
    setWallet(w => (w ? { ...w, [currency]: to } : w));
    countUp(currency === "coins" ? coinsEl.current : gemsEl.current, from, to, timers.current);
  }, []);
  const purse = <Purse coins={wallet ? wallet.coins : null} gems={wallet ? wallet.gems : null} coinsRef={coinsEl} gemsRef={gemsEl} />;
  return { wallet, purse, move };
}

/** Load once (and again on `reload`), keeping the last good data while a reload runs. */
function useData<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => load().then(d => { setData(d); setError(null); }, e => setError(errText(e))), [load]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, setError, reload };
}

// ── Fishing tasks ───────────────────────────────────────────────────────────────────────────────────────────────────

/** "7h", "2d": until the next Toronto day (or Monday) brings new tasks. */
function untilNext(period: "day" | "week", now = new Date()): string {
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", hour12: false, weekday: "short" }).formatToParts(now);
  const hour = Number(t.find(x => x.type === "hour")?.value ?? 0) % 24, day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(t.find(x => x.type === "weekday")?.value ?? "Mon");
  const hours = 24 - hour + (period === "week" ? (6 - day) * 24 : 0);
  return hours >= 48 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

function Task({ t, busy, onClaim }: { t: TaskView; busy: boolean; onClaim: () => void }) {
  const title = t.item_key ? `Catch a ${t.name}` : `${t.need} different fish`;
  return <TaskCard picture={t.item_key ? iconUrl(t.item_key) : <Fish size={26} />} rarity={t.rarity} title={title} have={t.have} need={t.need}
    reward={<Money n={t.reward} />} claimed={t.claimed} busy={busy} onClaim={onClaim} />;
}

/** Today's three and the week's two; each claims its coins once you've caught it. `onPaid`: the coins came in. */
export function FishingTasks({ transport = httpEconomyTransport, onPaid }: { transport?: EconomyTransport; onPaid?: (from: number, to: number) => void }) {
  const load = useCallback(() => transport.tasks(), [transport]);
  const { data, error, setError, reload } = useData<FishingTasksView>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const claim = async (t: TaskView) => {
    setBusy(t.id);
    try {
      const r = await transport.claimTask(t.id, t.period, newKey());
      onPaid?.(r.balance - r.paid, r.balance);
      await reload();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  };
  if (!data) return <Quiet>{error ?? "Reading the board…"}</Quiet>;
  return <div className={s.tasks}>
    {error ? <StatusLine error>{error}</StatusLine> : null}
    <section className={s.taskGroup} aria-label="Today">
      <h3 className={s.groupHead}><Sun size={18} aria-hidden /> Today <span className={s.renew} title="New tasks in"><Clock size={13} aria-hidden />{untilNext("day")}</span></h3>
      {data.daily.map(t => <Task key={t.id} t={t} busy={busy !== null} onClaim={() => void claim(t)} />)}
    </section>
    <section className={s.taskGroup} aria-label="This week">
      <h3 className={s.groupHead}><CalendarDays size={18} aria-hidden /> This week <span className={s.renew} title="New tasks in"><Clock size={13} aria-hidden />{untilNext("week")}</span></h3>
      {data.weekly.map(t => <Task key={t.id} t={t} busy={busy !== null} onClaim={() => void claim(t)} />)}
    </section>
  </div>;
}

/** The task board out front of the market: the tasks on their own. */
export function TaskBoardSheet({ open, onClose, keys, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; keys?: string; transport?: EconomyTransport }) {
  const till = useTill(transport);
  return <FlatPanel open={open} onClose={onClose} title="Fishing tasks" keys={keys} purse={till.purse} testId="task-board">
    {open ? <FishingTasks transport={transport} onPaid={(a, b) => till.move("coins", a, b)} /> : null}
  </FlatPanel>;
}

// ── The fish market's three places ──────────────────────────────────────────────────────────────────────────────────

const FISHY = new Set(["fish", "sea"]);
/** Quick sell: your fish as pictures; a tap sells one, the button sells every one you haven't locked. */
function QuickSell({ transport, onSold }: { transport: EconomyTransport; onSold: (from: number, to: number) => void }) {
  const load = useCallback(() => transport.sellable(), [transport]);
  const { data, error, setError, reload } = useData<SellEntry[]>(load);
  const [busy, setBusy] = useState(false);
  const fish = useMemo(() => (data ?? []).filter(e => FISHY.has(e.category)), [data]);
  const open = fish.filter(e => !e.locked), total = open.reduce((t, e) => t + e.price_each * e.count, 0);
  const sell = async (list: readonly (readonly [SellEntry, number])[]) => {
    setBusy(true);
    for (const [e, qty] of list) {
      const r = await sellAtCounter(transport, e, qty);
      if (r.ok) onSold(r.from, r.to); else { setError(r.error); break; }
    }
    await reload();
    setBusy(false);
  };
  if (!data) return <Quiet>{error ?? "Counting your fish…"}</Quiet>;
  return <div className={s.place}>
    {error ? <StatusLine error>{error}</StatusLine> : null}
    {fish.length === 0 ? <div className={s.empty}><Fish size={40} aria-hidden /><Quiet>No fish in your bag.</Quiet></div> : <>
      <div className={s.thumbGrid} role="list" aria-label="Your fish">
        {fish.map(e => <span role="listitem" key={e.item_key}>
          <Thumb picture={iconUrl(e.item_key)} rarity={e.rarity} size={76} count={e.count} label={`${e.name}: sell one for ${e.price_each} coins`} dim={e.locked}
            onClick={e.locked || busy ? undefined : () => void sell([[e, 1]])}
            tip={<TipBody picture={iconUrl(e.item_key)} rarity={e.rarity} kind={RARITY_LABEL[e.rarity as Rarity] ?? e.rarity} name={e.name}
              facts={[[<Coins key="c" size={14} />, <>{e.price_each.toLocaleString()} each</>], ...(e.locked ? [[<Lock key="l" size={14} />, "Locked in your bag"] as const] : [])]} />} />
        </span>)}
      </div>
      <div className={s.bar}>
        <span className={s.total}><HandCoins size={20} aria-hidden /><Money n={total} size={18} /></span>
        <DarkButton disabled={busy || open.length === 0} onClick={() => void sell(open.map(e => [e, e.count] as const))}>Sell all</DarkButton>
      </div>
    </>}
  </div>;
}

const loadMonthly = () => apiCall<MonthBoard>("/api/collections/monthly", "monthly");
const monthName = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-CA", { month: "long" });
/** The monthly board: the club's biggest of each fish this month, and yours to put up (it leaves your bag). */
function MonthlyBoard({ load }: { load: () => Promise<MonthBoard> }) {
  const { data, error, setError, reload } = useData<MonthBoard>(load);
  const [busy, setBusy] = useState<string | null>(null);
  const enter = async (key: string) => {
    setBusy(key);
    try {
      await apiCall("/api/collections/monthly", "entry", { item_key: key, idempotency_key: newKey() });
      await reload();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(null);
    }
  };
  if (!data) return <Quiet>{error ?? "Reading the board…"}</Quiet>;
  const ready = data.yours.filter(y => y.have > 0 && (y.entered === null || y.size_cm > y.entered));
  return <div className={s.monthly}>
    {error ? <StatusLine error>{error}</StatusLine> : null}
    <section aria-label={`${monthName(data.month)}'s board`} className={s.podium}>
      <h3 className={s.groupHead}><Trophy size={18} aria-hidden /> {monthName(data.month)}</h3>
      {data.board.length === 0 ? <Quiet>Nothing up yet. Be the first.</Quiet>
        : <ol className={s.ranks}>{data.board.map(t => <li key={t.key} data-mine={t.mine || undefined}>
          <b className={s.rank}>{t.rank}</b>
          <Thumb picture={t.icon ?? iconUrl(t.key)} rarity={t.rarity} size={52} label={t.name}
            tip={<TipBody picture={t.icon ?? iconUrl(t.key)} rarity={t.rarity} kind={RARITY_LABEL[t.rarity] ?? t.rarity} name={t.name} facts={[[<Ruler key="r" size={14} />, `${t.size_cm} cm`]]} />} />
          <span className={s.rankWho}><b>{t.mine ? "You" : t.member_name}</b><small>{t.name}</small></span>
          <span className={s.rankSize}>{t.size_cm}<small>cm</small></span>
        </li>)}</ol>}
    </section>
    <section aria-label="Put a fish up" className={s.enter}>
      <h3 className={s.groupHead}><Fish size={18} aria-hidden /> Yours</h3>
      {ready.length === 0 && data.yours.length === 0 ? <Quiet>Land a fish this month to put it up.</Quiet> : null}
      {data.yours.map(y => {
        const can = y.have > 0 && (y.entered === null || y.size_cm > y.entered);
        return <div key={y.key} className={s.enterRow}>
          <Thumb picture={y.icon ?? iconUrl(y.key)} rarity={y.rarity} size={48} count={y.have} label={y.name} />
          <span className={s.rankWho}><b>{y.name}</b><small>{y.size_cm} cm</small></span>
          {y.entered !== null && !can ? <span className={s.up} aria-label="On the board"><Check size={16} aria-hidden /></span>
            : <GhostButton disabled={!can || busy !== null} onClick={() => void enter(y.key)}>Put up</GhostButton>}
        </div>;
      })}
    </section>
  </div>;
}

/** The monthly board on its own (the portal's leaderboard). */
export const MonthlyBoardBody = () => <MonthlyBoard load={loadMonthly} />;

type MarketPlace = "sell" | "board" | "tasks";
const PLACES: RailItem<MarketPlace>[] = [
  { id: "sell", label: "Quick sell", icon: <HandCoins /> },
  { id: "board", label: "Monthly board", icon: <Trophy /> },
  { id: "tasks", label: "Fishing tasks", icon: <ListChecks /> },
];
const PLACE_TITLE: Record<MarketPlace, string> = { sell: "Quick sell", board: "Monthly board", tasks: "Fishing tasks" };

/** The fish market at its stall: quick sell, the monthly board and the tasks, one each down the rail. */
export function FishMarketSheet({ open, onClose, keys, transport = httpEconomyTransport, initial = "sell" }: {
  open: boolean; onClose: () => void; keys?: string; transport?: EconomyTransport; initial?: MarketPlace;
}) {
  const [place, setPlace] = useState<MarketPlace>(initial);
  const till = useTill(transport);
  return <FlatPanel open={open} onClose={onClose} title={PLACE_TITLE[place]} keys={keys} purse={till.purse} contentKey={place} testId="fish-market"
    rail={<IconRail items={PLACES} value={place} onChange={setPlace} label="Fish market" />}>
    {!open ? null : place === "sell" ? <QuickSell transport={transport} onSold={(a, b) => till.move("coins", a, b)} />
      : place === "board" ? <MonthlyBoard load={loadMonthly} />
      : <FishingTasks transport={transport} onPaid={(a, b) => till.move("coins", a, b)} />}
  </FlatPanel>;
}

// ── The tackle shop's counter ───────────────────────────────────────────────────────────────────────────────────────

const LADDER: Rarity[] = ["divine", "legendary", "epic", "rare", "uncommon", "common"];
const COUNTERS: RailItem<Counter>[] = [{ id: "coins", label: "Coin counter", icon: <Coins /> }, { id: "gems", label: "Gem counter", icon: <Gem /> }];
const SLOT_WORD = { bait: "Bait", bobber: "Bobber", rod: "Rod" } as const;
const prizeTip = (key: string) => {
  const it = prizeByKey(key);
  return it ? <TipBody picture={iconUrl(it.icon)} rarity={it.rarity} kind={`${RARITY_LABEL[it.rarity]} ${SLOT_WORD[it.slot].toLowerCase()}`} name={it.name} facts={[[<Fish key="d" size={14} />, it.does]]} /> : null;
};

/**
 * The counter: the season's crazy ones up top, 1 or 10 pulls, the odds always beside it (Gems are a paid currency, so
 * what each pull can give and how likely is never hidden). A roll turns the cards over (GachaReveal) and the best prize
 * pops as a reward card (RewardCard).
 */
/** `onRods`: the shop's rods (rod-gear's Browse rods), from the same door. */
export function TackleCounterSheet({ open, onClose, onRods, keys, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; onRods?: () => void; keys?: string; transport?: EconomyTransport }) {
  const [counter, setCounter] = useState<Counter>("coins");
  const till = useTill(transport);
  const load = useCallback(() => transport.tackle(), [transport]);
  const { data, error, setError } = useData<TackleView>(load);
  const [won, setWon] = useState<RevealItem[] | null>(null), [busy, setBusy] = useState(false);
  const roll = async (pulls: Pulls) => {
    if (!data || !till.wallet) return;
    setBusy(true);
    setWon(null);
    try {
      const r = await transport.roll(counter, pulls, newKey());
      const cost = pulls === 10 ? data.counters[counter].ten : data.counters[counter].each;
      till.move(counter, r.balance + cost, r.balance);
      setWon(r.prizes.map(k => { const it = prizeByKey(k)!; return { key: k, picture: iconUrl(it.icon), name: it.name, rarity: it.rarity, tip: prizeTip(k) }; }));
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  // The best of the roll pops as the game's reward card once the cards are face up.
  const popBest = useCallback(() => {
    if (!won) return;
    const best = [...won].sort((a, b) => LADDER.indexOf(a.rarity as Rarity) - LADDER.indexOf(b.rarity as Rarity))[0], it = prizeByKey(best.key);
    if (!it) return;
    window.dispatchEvent(new CustomEvent("tsi:gift", { detail: { key: it.icon, name: it.name, title: `${RARITY_LABEL[it.rarity]} ${SLOT_WORD[it.slot].toLowerCase()}`, note: it.does } }));
  }, [won]);
  const c = data?.counters[counter], have = till.wallet ? till.wallet[counter] : 0;
  const rows: OddsRow[] = useMemo(() => {
    if (!c) return [];
    const by = new Map<string, OddsRow>();
    for (const o of c.odds) {
      const it = prizeByKey(o.key);
      if (!it) continue;
      const row = by.get(it.rarity) ?? { rarity: it.rarity, label: RARITY_LABEL[it.rarity], chance: 0, items: [] };
      by.set(it.rarity, { ...row, chance: row.chance + o.chance, items: [...row.items, { key: o.key, picture: iconUrl(it.icon), name: it.name, chance: o.chance, tip: prizeTip(o.key) }] });
    }
    return LADDER.flatMap(r => (by.has(r) ? [by.get(r)!] : []));
  }, [c]);
  const crazy = data ? rows.find(r => r.rarity === "legendary")?.items ?? [] : [];
  return <FlatPanel open={open} onClose={onClose} title="Tackle counter" keys={keys} purse={till.purse} contentKey={counter} testId="tackle-counter"
    rail={<IconRail items={COUNTERS} value={counter} onChange={k => { setCounter(k); setWon(null); }} label="Counters" />}>
    {!data || !c ? <Quiet>{error ?? "Opening the counter…"}</Quiet> : <div className={s.counter}>
      <div className={s.counterMain}>
        {error ? <StatusLine error>{error}</StatusLine> : null}
        <div className={s.stage} data-counter={counter}>
          {won ? <GachaReveal items={won} onDone={popBest} /> : <div className={s.banner}>
            <span className={s.season}>{data.season}</span>
            <div className={s.crazy}>{crazy.map(it => <Thumb key={it.key} picture={it.picture} rarity="legendary" size={120} label={it.name} tip={it.tip} />)}</div>
            <span className={s.standIn}>Pictures are stand-ins until the models are made</span>
          </div>}
        </div>
        <div className={s.pulls}>
          {([1, 10] as const).map(n => {
            const cost = n === 10 ? c.ten : c.each;
            return <button key={n} type="button" className={s.pull} data-ten={n === 10 || undefined} disabled={busy || !till.wallet || have < cost} onClick={() => void roll(n)}>
              <b>×{n}</b><Money n={cost} currency={counter} size={18} />
            </button>;
          })}
        </div>
      </div>
      <aside className={s.oddsSide} aria-label="The odds">
        <h3 className={s.groupHead}>Odds</h3>
        <OddsTable rows={rows} />
        {onRods && <GhostButton onClick={onRods}>Browse rods</GhostButton>}
      </aside>
    </div>}
  </FlatPanel>;
}

// ── The chef's order ────────────────────────────────────────────────────────────────────────────────────────────────

/** The chef's order by day: the fish he wants, large; what he pays as icons; one action. */
export function ChefOrderDialog({ open, onClose, keys, transport = httpEconomyTransport }: { open: boolean; onClose: () => void; keys?: string; transport?: EconomyTransport }) {
  const load = useCallback(() => Promise.all([transport.chef(), transport.sellable()]), [transport]);
  const [data, setData] = useState<[ChefView, SellEntry[]] | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const reload = useCallback(() => load().then(d => { setData(d); setError(null); }, e => setError(errText(e))), [load]);
  useEffect(() => { if (open) void reload(); }, [open, reload]);
  const order = data?.[0].order, have = order ? data![1].find(e => e.item_key === order.item_key) : undefined;
  const handOver = async () => {
    if (!order) return;
    setBusy(true);
    try {
      await transport.fillChef(order.item_key, newKey());
      await reload();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  let action: ReactNode;
  if (!order) action = null;
  else if (order.filled) action = <span className={s.served}><Check size={18} aria-hidden /> Done today</span>;
  else if (have?.locked) action = <DarkButton disabled><Lock size={15} aria-hidden /> Locked</DarkButton>;
  else action = <DarkButton disabled={busy || !have} onClick={() => void handOver()}>{have ? "Hand it over" : "Catch one first"}</DarkButton>;
  return <FlatDialog open={open} onClose={onClose} title="Today's order" keys={keys} testId="chef-order">
    {!data ? <Quiet>{error ?? "Bancha looks up…"}</Quiet> : !order ? <div className={s.empty}><ChefHat size={40} aria-hidden /><Quiet>Nothing worth cooking is biting.</Quiet></div> : <>
      <div className={s.orderStage} data-rarity={order.rarity}>
        <span className={s.chef} aria-hidden><ChefHat size={22} /></span>
        <Thumb picture={iconUrl(order.item_key)} rarity={order.rarity} size={168} label={order.name} count={have?.count}
          tip={<TipBody picture={iconUrl(order.item_key)} rarity={order.rarity} kind={RARITY_LABEL[order.rarity as Rarity] ?? order.rarity} name={order.name} />} />
        <b className={s.orderName}>{order.name}</b>
      </div>
      {error ? <StatusLine error>{error}</StatusLine> : null}
      <div className={s.pays} aria-label="He pays">
        <span className={s.payChip}><Money n={order.reward} size={20} /></span>
        <HoverTip tip={<TipBody name="A staff meal" facts={[[<Soup key="m" size={14} />, mealText(order.meal, order.meal.minutes)]]} />}>
          <span className={s.payChip} tabIndex={0} aria-label={`A staff meal: ${mealText(order.meal, order.meal.minutes)}`}><Soup size={20} aria-hidden /><span>{order.meal.minutes}m</span></span>
        </HoverTip>
      </div>
      <div className={s.orderAction}>{action}</div>
    </>}
  </FlatDialog>;
}

