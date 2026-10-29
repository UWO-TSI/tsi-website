"use client";

/**
 * More flat kit pieces (specs/design-bible.md UI; shown at /lab/gui?only=flat-pieces): a picture tile with its rarity
 * edge (`Thumb`), a hover card that says what something is (`HoverTip`), a day strip of what's on when (`TimeStrip`),
 * the odds of a roll (`OddsTable`), the cards turning over after a roll (`GachaReveal`), a task with its progress and
 * one claim (`TaskCard`), a small panel for one action (`FlatDialog`), and paper for things that are paper in the world
 * (`PaperSheet`, `MenuRow`: a restaurant's menu). Colours: the theme's --ui-* tokens only.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Moon, Sun, Sunrise, Sunset, X } from "lucide-react";
import PixelImage from "@/components/economy/PixelImage";
import { usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import { GuiVariantContext } from "../variant";
import p from "./pieces.module.css";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// ── A picture tile and its hover card ───────────────────────────────────────────────────────────────────────────────

/**
 * An item's picture on a white tile (the pixel finish), its rarity a thin edge (divine: the holo), never a fill; a count
 * at its shoulder; `dim` when it isn't out now; `tip`: a hover card (HoverTip) on hover and keyboard focus.
 */
export function Thumb({ picture, rarity, size = 52, count, dim, mark, tip, label, onClick, selected, className }: {
  picture: string | ReactNode; rarity?: string | null; size?: number; count?: number; dim?: boolean;
  /** A small dot on the corner (leaving soon, new). */
  mark?: boolean; tip?: ReactNode; label: string; onClick?: () => void; selected?: boolean; className?: string;
}) {
  const face = <>
    {typeof picture === "string" ? <PixelImage src={picture} px={Math.round(size * 0.7)} className={p.thumbArt} /> : <span className={p.thumbArt} aria-hidden>{picture}</span>}
    {count && count > 1 ? <span className={p.thumbCount}>×{count}</span> : null}
    {mark ? <span className={p.thumbMark} aria-hidden /> : null}
  </>;
  const look = { className: cx(p.thumb, className), "data-rarity": rarity ?? undefined, "data-dim": dim || undefined, "data-selected": selected || undefined, style: { "--thumb": `${size}px` } as CSSProperties };
  const el = onClick || tip
    ? <button type="button" {...look} aria-label={label} aria-pressed={selected === undefined ? undefined : selected} onClick={onClick}>{face}</button>
    : <span {...look} role="img" aria-label={label}>{face}</span>;
  return tip ? <HoverTip tip={tip}>{el}</HoverTip> : el;
}

/**
 * A white card that says what something is, beside it, on hover and on keyboard focus (David: "you can hover to see what
 * the fish is"). It floats over everything (a portal), so a scrolling panel never clips it, and turns away from the
 * screen's edges.
 */
export function HoverTip({ tip, children }: { tip: ReactNode; children: ReactNode }) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const id = useId();
  const show = (e: PointerEvent<HTMLSpanElement> | FocusEvent<HTMLSpanElement>) => setAt((e.currentTarget.firstElementChild ?? e.currentTarget).getBoundingClientRect());
  return <span className={p.tipHost} onPointerEnter={show} onPointerLeave={() => setAt(null)} onFocus={show} onBlur={() => setAt(null)} aria-describedby={at ? id : undefined}>
    {children}
    {at ? <TipCard id={id} at={at}>{tip}</TipCard> : null}
  </span>;
}

function TipCard({ id, at, children }: { id: string; at: DOMRect; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth, h = el.offsetHeight, gap = 10, vw = window.innerWidth;
    const below = at.top - h - gap < 8;
    setPos({ x: Math.min(Math.max(8, at.left + at.width / 2 - w / 2), vw - w - 8), y: below ? at.bottom + gap : at.top - h - gap, below });
  }, [at]);
  return createPortal(<div ref={ref} id={id} role="tooltip" className={p.tip} data-below={pos?.below || undefined}
    style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999, visibility: pos ? "visible" : "hidden" }}>{children}</div>, document.body);
}

/** A hover card's usual inside: the picture large, a quiet kind line, the name, then a few facts as icon and words. */
export function TipBody({ picture, rarity, kind, name, facts, children }: {
  picture?: string; rarity?: string | null; kind?: ReactNode; name: ReactNode; facts?: readonly (readonly [ReactNode, ReactNode])[]; children?: ReactNode;
}) {
  return <div className={p.tipBody}>
    <div className={p.tipHead}>
      {picture ? <span className={p.tipArt} data-rarity={rarity ?? undefined}><PixelImage src={picture} px={48} /></span> : null}
      <span className={p.tipName}>{kind ? <small data-rarity={rarity ?? undefined}>{kind}</small> : null}<b>{name}</b></span>
    </div>
    {facts && facts.length ? <dl className={p.tipFacts}>{facts.map(([icon, text], i) => <div key={i}><dt aria-hidden>{icon}</dt><dd>{text}</dd></div>)}</dl> : null}
    {children}
  </div>;
}

/** Twelve month dots, the `on` months filled and this month ringed (a hover card's season). */
export function MonthDots({ on, now }: { on: readonly number[]; now: number }) {
  return <span className={p.months} aria-label={on.length >= 12 ? "All year" : `In season: ${on.map(m => MONTHS[m - 1]).join(", ")}`}>
    {MONTHS.map((m, i) => <i key={m} title={m} data-on={on.includes(i + 1) || undefined} data-now={i + 1 === now || undefined}>{m[0]}</i>)}
  </span>;
}
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── The day strip ───────────────────────────────────────────────────────────────────────────────────────────────────

export interface StripItem { key: string; picture: string; rarity?: string | null; label: string; mark?: boolean }
/** A row of things on at the same hours (`hours`: 24 flags, hour 0 first). */
export interface StripBand<T extends StripItem = StripItem> { id: string; hours: readonly boolean[]; items: readonly T[] }
export interface StripLane<T extends StripItem = StripItem> { id: string; icon: ReactNode; label: string; bands: readonly StripBand<T>[]; closed?: ReactNode }

/** A band's runs of hours on, as [from, to) hour pairs; a run over midnight is two. */
export function runsOf(hours: readonly boolean[]): [number, number][] {
  const out: [number, number][] = [];
  for (let h = 0; h < 24; h++) if (hours[h] && (h === 0 || !hours[h - 1])) { let e = h; while (e < 24 && hours[e]) e++; out.push([h, e]); }
  return out;
}
/** `n` things shared over runs by their length (largest remainder), at least one each while there are enough. */
export function shareOut(runs: readonly [number, number][], n: number): number[] {
  const total = runs.reduce((s, [a, b]) => s + b - a, 0);
  if (!total) return runs.map(() => 0);
  const raw = runs.map(([a, b]) => (n * (b - a)) / total), got = raw.map(Math.floor);
  let left = n - got.reduce((s, x) => s + x, 0);
  for (const i of raw.map((r, i) => [r - Math.floor(r), i]).sort((x, y) => y[0] - x[0]).map(([, i]) => i)) if (left > 0) { got[i]++; left--; }
  return got;
}

const TICKS: readonly [number, ReactNode][] = [[0, <Moon key="m" size={14} />], [6, <Sunrise key="r" size={14} />], [12, <Sun key="s" size={14} />], [18, <Sunset key="e" size={14} />], [24, <Moon key="n" size={14} />]];
const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;

/**
 * The day as a strip (David: "a time graphic with the things available"): the hours across, the sun and moon over them,
 * a needle at `now`; a lane per place (its icon down the left), and in it a band per span of hours with the things on
 * then as pictures along it. What's on now is bright, the rest quiet. Each picture's `tip` is its hover card.
 */
export function TimeStrip<T extends StripItem>({ now, lanes, tip, label }: { now: number; lanes: readonly StripLane<T>[]; tip: (item: T) => ReactNode; label: string }) {
  const hour = Math.floor(now) % 24;
  return <div className={p.strip} role="group" aria-label={label} style={{ "--now": `${(now % 24) / 24}` } as CSSProperties}>
    <div className={p.axis} aria-hidden>
      <span />
      <span className={p.axisTrack}>
        {Array.from({ length: 25 }, (_, h) => <i key={h} className={p.tick} data-major={h % 6 === 0 || undefined} style={{ left: `${(h / 24) * 100}%` }} />)}
        {TICKS.map(([h, icon]) => <span key={h} className={p.tickLabel} style={{ left: `${(h / 24) * 100}%` }}>{icon}<small>{h === 24 ? "" : `${h}:00`}</small></span>)}
        <span className={p.nowPill}>{clock(now)}</span>
      </span>
    </div>
    {lanes.map(lane => <section key={lane.id} className={p.lane} aria-label={lane.label} data-closed={lane.closed ? "" : undefined}>
      <span className={p.laneIcon} title={lane.label}>{lane.icon}</span>
      <div className={p.laneTrack}>
        {lane.closed ? <div className={p.closed}>{lane.closed}</div> : lane.bands.map(band => {
          const runs = runsOf(band.hours), share = shareOut(runs, band.items.length);
          let at = 0;
          return <div key={band.id} className={p.band} data-now={band.hours[hour] || undefined}>
            {runs.map(([a, b], i) => {
              const mine = band.items.slice(at, (at += share[i]));
              return <div key={a} className={p.run} style={{ gridColumn: `${a + 1} / ${b + 1}` }} data-edge={`${a === 0 ? "s" : ""}${b === 24 ? "e" : ""}` || undefined}>
                {mine.map(it => <Thumb key={it.key} picture={it.picture} rarity={it.rarity} size={40} label={it.label} mark={it.mark} dim={!band.hours[hour]} tip={tip(it)} />)}
              </div>;
            })}
          </div>;
        })}
      </div>
    </section>)}
    <i className={p.needle} aria-hidden />
  </div>;
}

// ── Odds ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface OddsRow { rarity: string; label: string; chance: number; items: readonly { key: string; picture: string; name: string; chance: number; tip?: ReactNode }[] }
/** "12.5%", "0.25%": a chance as people read it. */
export const pct = (n: number) => `${n >= 10 ? Math.round(n * 10) / 10 : n >= 1 ? Math.round(n * 100) / 100 : Math.round(n * 1000) / 1000}%`;
/**
 * A roll's odds, always in view where something is rolled for Gems (a paid currency): each rarity's chance, and every
 * prize in it with its own (hover one for what it is).
 */
export function OddsTable({ rows, label = "The odds" }: { rows: readonly OddsRow[]; label?: string }) {
  return <dl className={p.odds} aria-label={label}>
    {rows.map(r => <div key={r.rarity} className={p.oddsRow}>
      <dt data-rarity={r.rarity}><span>{r.label}</span><b>{pct(r.chance)}</b></dt>
      <dd>{r.items.map(it => <span key={it.key} className={p.oddsItem}>
        <Thumb picture={it.picture} rarity={r.rarity} size={40} label={`${it.name}, ${pct(it.chance)}`} tip={it.tip} />
        <small>{pct(it.chance)}</small>
      </span>)}</dd>
    </div>)}
  </dl>;
}

// ── The reveal after a roll ─────────────────────────────────────────────────────────────────────────────────────────

export interface RevealItem { key: string; picture: string; name: string; rarity: string; tip?: ReactNode }
const RANK = ["common", "uncommon", "rare", "epic", "legendary", "divine"];
/**
 * The cards turning over after a roll: face down first, then each flips in turn with a spring (1 large, or 10 in two
 * rows), the rarer the later and the bigger its pop; the best one glows. `onDone` once the last is face up. Under
 * reduced motion they're simply face up.
 */
export function GachaReveal({ items, onDone, stagger = 140 }: { items: readonly RevealItem[]; onDone?: () => void; stagger?: number }) {
  const best = Math.max(...items.map(i => RANK.indexOf(i.rarity)));
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => done.current?.(), reduce ? 0 : 450 + stagger * items.length + 600);
    return () => window.clearTimeout(t);
  }, [items, stagger]);
  return <ol className={p.reveal} data-one={items.length === 1 || undefined} aria-label="What you got">
    {items.map((it, i) => <li key={`${it.key}-${i}`} className={p.revealCard} data-rarity={it.rarity} data-best={RANK.indexOf(it.rarity) === best && best >= 3 || undefined}
      style={{ "--i": i, "--stagger": `${stagger}ms` } as CSSProperties}>
      <span className={p.revealBack} aria-hidden />
      <span className={p.revealFace}>
        <HoverTip tip={it.tip ?? <b>{it.name}</b>}><span className={p.revealArt} tabIndex={0} aria-label={it.name}><PixelImage src={it.picture} px={items.length === 1 ? 72 : 48} /></span></HoverTip>
        <span className={p.revealName}>{it.name}</span>
      </span>
    </li>)}
  </ol>;
}

// ── A task ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A task as a white card: what to catch (its picture, rarity edge), how far along, what it pays, and its one action:
 * Claim once it's done (David: "if you did it you claim it"), a check once claimed.
 */
export function TaskCard({ picture, title, rarity, have, need, reward, claimed, busy, onClaim, claimLabel = "Claim" }: {
  picture: string | ReactNode; title: ReactNode; rarity?: string | null; have: number; need: number; reward: ReactNode; claimed: boolean; busy?: boolean;
  onClaim: () => void; claimLabel?: string;
}) {
  const done = have >= need;
  return <article className={p.task} data-done={done || undefined} data-claimed={claimed || undefined}>
    <Thumb picture={picture} rarity={rarity} size={56} label={typeof title === "string" ? title : "Task"} />
    <div className={p.taskText}>
      <b>{title}</b>
      <span className={p.taskBar} role="progressbar" aria-valuemin={0} aria-valuemax={need} aria-valuenow={Math.min(have, need)}>
        <i style={{ transform: `scaleX(${Math.min(1, have / need)})` }} />
      </span>
      <small>{Math.min(have, need)} / {need}</small>
    </div>
    <span className={p.taskReward}>{reward}</span>
    {claimed ? <span className={p.taskDone} aria-label="Claimed"><Check size={18} aria-hidden /></span>
      : <button type="button" className={p.claim} disabled={!done || busy} onClick={onClaim}>{claimLabel}</button>}
  </article>;
}

// ── A small panel ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The flat panel's small sibling, for one thing and one action (the chef's order): a scrim, a white-on-grey card in the
 * middle, its title and a round close. The dialog system gives it focus, Escape and the opening key, as FlatPanel's.
 */
export function FlatDialog({ open, onClose, title, keys, testId, children }: { open: boolean; onClose: () => void; title: string; keys?: string | readonly string[]; testId?: string; children: ReactNode }) {
  const state = usePresence(open);
  const panel = useWorldDialog<HTMLElement>(open, onClose, keys);
  if (!state) return null;
  return <div className={p.dialogLayer} data-state={state}>
    <div className={p.dialogScrim} onClick={onClose} aria-hidden />
    <section ref={panel} role="dialog" aria-modal aria-label={title} tabIndex={-1} data-gui-dialog data-gui-overlay data-gui-flat="" className={p.dialog} data-testid={testId}>
      <GuiVariantContext.Provider value="flat">
        <header className={p.dialogTop}><h2>{title}</h2><button type="button" className={p.dialogClose} aria-label="Close" onClick={onClose}><X size={18} aria-hidden /></button></header>
        {children}
      </GuiVariantContext.Provider>
    </section>
  </div>;
}

// ── Paper ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Paper, the material (design bible UI 2): only for what is paper in the world. A cream sheet with a fibre grain and a thin double rule inside its edge. */
export function PaperSheet({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={cx(p.paper, className)} style={style}>{children}</div>;
}
/** A paper heading: small spaced capitals between two rules. */
export function PaperHeading({ children }: { children: ReactNode }) {
  return <h3 className={p.paperHeading}><span>{children}</span></h3>;
}

/**
 * A dish on a printed menu: its picture on a plate, the name, a dotted leader and the price; hovered or focused, the one
 * plain line of what it does slides in under the name (David: "hover over dishes show what they do"). The row is the
 * action (ordering it).
 */
export function MenuRow({ picture, name, note, does, price, standIn, disabled, open, onPick, children }: {
  picture: ReactNode; name: ReactNode; note?: ReactNode; does: ReactNode; price: ReactNode; standIn?: boolean; disabled?: boolean;
  /** Picked: its line stays out and `children` (its action) shows under it. */
  open?: boolean; onPick?: () => void; children?: ReactNode;
}) {
  return <div className={p.menuRow} data-disabled={disabled || undefined} data-open={open || undefined}>
    <button type="button" className={p.menuPick} disabled={disabled} aria-expanded={open} onClick={onPick}>
      <span className={p.plate} aria-hidden>{picture}{standIn ? <span className={p.standIn}>stand-in</span> : null}</span>
      <span className={p.menuText}>
        <span className={p.menuLine}><b>{name}</b><i className={p.leader} aria-hidden /><span className={p.menuPrice}>{price}</span></span>
        {note ? <span className={p.menuNote}>{note}</span> : null}
        <span className={p.menuDoes}>{does}</span>
      </span>
    </button>
    {open ? children : null}
  </div>;
}
