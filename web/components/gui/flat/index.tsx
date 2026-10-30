"use client";

/**
 * The flat UI kit (specs/polish/flat-ui.md, ledger row 315): the shop overlay's pieces (round 4, approved 2026-10-18),
 * shared so the game's menus can wear the same style. One flat light-grey panel over most of the screen (`FlatPanel`):
 * a purse top left, the title, a round close; a rail of icons down the left (`IconRail`); white cards in a grid
 * (`CardGrid`, `ItemCard`); an item opened in the same panel on the white studio stage (`DetailView`, `SpecBand`); and the
 * small parts (`Pill`, `DarkButton`, `GhostButton`, `RoundButton`, `HairlineRow`). Colours: the theme's --ui-* tokens
 * (styles/themes). Nothing here knows about the shop: every piece takes plain props.
 */
import type { Rarity } from "@/lib/rarity";
import { Fragment, useEffect, useMemo, useRef, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Heart, Sparkles, Star, X, Zap } from "lucide-react";
import { usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import { CurrencyIcon } from "@/components/economy/Amount";
import PixelImage from "@/components/economy/PixelImage";
import { GuiVariantContext } from "../variant";
import { bothRefs, useMarker, useNudge } from "../motion";
import f from "./flat.module.css";

/** The kit's class names, for the odd surface that lays out its own content in the flat style. */
export { f as flatStyles };
export { CardOverlay, FLY_MS, FlyIn, KEYBOARD, KeyBoard, PaperField, PrintedCard, QUEST_CHECK_MS, QuestCheck, SlotPop, Spotlight, boardLabel, type BoardKey } from "./moments";
export { CountUp, WalletSlot } from "./wallet";
export { KEYWORD_KINDS, Keyword, KeywordLine, keywordParts, type KeywordKind, type LinePart } from "./keyword";
export { ProgressCard } from "./ProgressCard";
/** The detail stage's classes: a viewer (TurnStage, ItemViewer, the keychain's stage) fills `stage`; a picture `picture`. */
export const STAGE = { stage: f.stage, picture: f.stagePicture } as const;
/**
 * A grid of its own (the bag's slots, the catalogue's pieces) moving as `CardGrid` does: put `NUDGE_GRID` on it and
 * `useNudge()`'s ref, and keep each cell a direct child.
 */
export const NUDGE_GRID = f.nudge;
export { useNudge };
/** The reward pieces: hearts in halves, the reward track, the prize wheel, the goal meter (rewards.tsx). */
export { GoalMeter, HeartMeter, RewardTrack, PrizeWheel, WHEEL_SPIN_MS, type TrackStep, type WheelPrize } from "./rewards";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// ── The panel ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The flat panel: a scrim, one light-grey panel over most of the screen (the whole screen on a phone), a top bar with
 * the purse slot (`purse`), the title and a round close, the rail (`rail`) down the left and the content. Focus,
 * Escape, the opening key (`keys`), the world's hotkeys held and the paper sound come from the dialog system
 * (lib/game/useWorldDialog), as every sheet's do. `embedded`: the same panel on a page (the portal's shop), with no
 * scrim and no dialog; no close without `onClose`. `contentKey`: what the content shows (the rail's choice); when it
 * changes, the new content fades and slides in a few px.
 */
export function FlatPanel({ open, onClose, title, purse, rail, keys, testId, embedded, contentKey, children }: {
  open: boolean; onClose?: () => void; title: string;
  /** Top left: the coins and Gems (`Purse`), or anything else short. */
  purse?: ReactNode;
  /** Down the left: an `IconRail`. */
  rail?: ReactNode;
  keys?: string | readonly string[]; testId?: string; embedded?: boolean; contentKey?: string; children: ReactNode;
}) {
  const state = usePresence(open);
  // A new key remounts the content, so it plays its entrance (flat.module.css .main > *).
  const content = <Fragment key={contentKey ?? ""}>{children}</Fragment>;
  const panel = useWorldDialog<HTMLElement>(open && !embedded, onClose ?? noop, keys);
  const top = <header className={f.top}>
    {purse ?? <span />}
    <h2 className={f.heading}>{title}</h2>
    {onClose ? <button type="button" className={f.close} aria-label="Close" onClick={onClose}><X size={18} aria-hidden /></button> : <span />}
  </header>;
  // The GUI pieces inside wear the flat look too (components/gui/variant).
  if (embedded) return <GuiVariantContext.Provider value="flat"><section aria-label={title} className={f.panel} data-testid={testId} data-rail={rail ? "" : undefined} data-embedded="" data-gui-flat="">
    {top}{rail}<div className={f.main}>{content}</div>
  </section></GuiVariantContext.Provider>;
  if (!state) return null;
  return <div className={f.layer} data-state={state}>
    <div className={f.scrim} onClick={onClose} aria-hidden="true" />
    <section ref={panel} role="dialog" aria-modal aria-label={title} tabIndex={-1} data-gui-dialog data-gui-overlay className={f.panel} data-testid={testId} data-rail={rail ? "" : undefined} data-gui-flat="">
      <GuiVariantContext.Provider value="flat">
        {top}
        {rail}
        <main className={f.main}>{content}</main>
      </GuiVariantContext.Provider>
    </section>
  </div>;
}
const noop = () => {};

/** The coins and Gems as plain icon and number pairs (`null`: still loading). The refs let a till count them up. */
export function Purse({ coins, gems, coinsRef, gemsRef }: {
  coins: number | null; gems: number | null; coinsRef?: Ref<HTMLSpanElement>; gemsRef?: Ref<HTMLSpanElement>;
}) {
  return <span className={f.purse} aria-label="Your coins and Gems">
    <span className={f.amount}><CurrencyIcon size={18} /><span ref={coinsRef}>{coins === null ? "…" : coins.toLocaleString()}</span></span>
    <span className={f.amount}><CurrencyIcon currency="gems" size={18} /><span ref={gemsRef}>{gems === null ? "…" : gems.toLocaleString()}</span></span>
  </span>;
}

// ── The rail ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type RailItem<T extends string = string> = { id: T; label: string; icon: ReactNode; badge?: number; disabled?: boolean };

/** A rail icon's count: nothing at zero, capped at 99+. */
export function badgeText(n: number | undefined): string | null {
  if (!n || n < 1) return null;
  return n > 99 ? "99+" : String(n);
}

/** The rail item `by` steps from `value` (wrapping, skipping disabled ones); `value` when nothing else can be chosen. */
export function railStep<T extends string>(items: readonly RailItem<T>[], value: T, by: number): T {
  const usable = items.filter(i => !i.disabled);
  if (!usable.length) return value;
  const at = usable.findIndex(i => i.id === value);
  const from = at < 0 ? (by > 0 ? -1 : 0) : at;
  return usable[(((from + by) % usable.length) + usable.length) % usable.length].id;
}

/**
 * Icons only (their labels are for screen readers and the tooltip); the chosen one black with a dot under it that slides
 * to the next choice, a press that dips and springs back, a count badge where `badge` is set. Down the left of a `FlatPanel` (across the top on a phone); `horizontal` puts it across
 * the top anywhere. `tabs`: it is a tab list (a flat `Sheet`'s `Tabs`): role tab, aria-selected, and the caller's
 * `onKeyDown` and `listRef` for the arrow keys. `itemAttrs`: more attributes for an icon's button (the creator's tab
 * ids and the panel it controls).
 */
export function IconRail<T extends string>({ items, value, onChange, label, orientation = "vertical", tabs, listRef, onKeyDown, className, itemAttrs }: {
  items: readonly RailItem<T>[]; value: T | null; onChange: (id: T) => void; label: string;
  orientation?: "vertical" | "horizontal"; tabs?: boolean; listRef?: Ref<HTMLElement>; onKeyDown?: (e: KeyboardEvent) => void; className?: string;
  itemAttrs?: (item: RailItem<T>) => Record<string, string | undefined>;
}) {
  // A tab list is a div (role tablist); a rail of shelves is the panel's nav.
  const Tag = (tabs ? "div" : "nav") as "nav";
  const own = useRef<HTMLElement | null>(null);
  const ref = useMemo(() => bothRefs<HTMLElement>(own, listRef), [listRef]);
  const m = useMarker(own, tabs ? '[aria-selected="true"]' : "[aria-current]", value);
  return <Tag ref={ref} className={cx(f.side, className)} aria-label={label} role={tabs ? "tablist" : undefined}
    data-orientation={orientation === "horizontal" ? "horizontal" : undefined} data-marker={m ? "" : undefined} onKeyDown={onKeyDown}>
    {/* The chosen icon's dot, sliding from one to the next (its own ::after until measured). */}
    {m ? <span className={f.marker} aria-hidden style={{ transform: `translate(${m.x + m.w / 2 - 2}px, ${m.y + m.h - 7}px)` }} /> : null}
    {items.map(it => {
      const on = it.id === value, badge = badgeText(it.badge);
      return <button key={it.id} type="button" className={f.shelf} aria-label={it.label} title={it.label} disabled={it.disabled}
        {...(tabs ? { role: "tab", "aria-selected": on, tabIndex: on ? 0 : -1, "data-tab": it.id } : { "aria-current": on || undefined })}
        {...itemAttrs?.(it)} onClick={() => onChange(it.id)}>
        {it.icon}
        {badge ? <span className={f.badge}>{badge}</span> : null}
      </button>;
    })}
  </Tag>;
}

// ── Cards ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A shelf of cards, with its title above. `min`: the narrowest a card gets (px; 250 by default); `phoneMin`: on a phone
 * (one card a row by default, as the shop has it). Its cells move (round 3): a hovered card grows a little out of the
 * grid and its neighbours step aside, quickly; the picked one (`selected`) further, slower, and stays out.
 */
export function CardGrid({ title, min, phoneMin, label, children }: { title?: ReactNode; min?: number; phoneMin?: number; label?: string; children: ReactNode }) {
  const style = { ...(min ? { "--card-min": `${min}px` } : {}), ...(phoneMin ? { "--card-min-phone": `${phoneMin}px` } : {}) } as CSSProperties;
  const nudge = useNudge();
  return <>
    {title ? <h3 className={f.shelfTitle}>{title}</h3> : null}
    <div ref={nudge} className={cx(f.grid, f.nudge)} role={label ? "list" : undefined} aria-label={label} style={min || phoneMin ? style : undefined}>{children}</div>
  </>;
}

export type CardCover = "sold-out" | "owned" | "not-found";
/** A price: its amount and currency. An amount of nothing (unset, or 0) is a price still to come. */
export type Price = { amount: number | null | undefined; currency: string };
export const PRICE_TO_COME = "Price to come";
/** Has it a price you can pay? */
export const priced = (p: Price | null | undefined): boolean => !!p && !!p.amount;
const COVER_TEXT: Record<Exclude<CardCover, "not-found">, string> = { "sold-out": "Sold out", owned: "Owned" };

/**
 * A white card: the picture centred with lots of air (a URL gets the pixel finish, `PixelImage`), the name small and a
 * muted line bottom left, a grey pill bottom right, an optional tag top left and a small ↗ top right. `cover`: sold
 * out or owned (a white veil with the word), or not found yet (the picture as a silhouette). With `onClick` it is a
 * button; without, a picture. `size`: "lg" (the shop's), "md" or "sm" for many to a screen. `price`: the pill shows it
 * (its amount and currency's icon), or "Price to come" while it has none; `pill` is any other short value.
 */
export function ItemCard({ picture, px = 44, name, line, price, pill: other, tag, arrow = true, cover, selected, size = "lg", label, testId, onClick, className, ...rest }:
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> & {
    picture: string | ReactNode; px?: number; name: ReactNode; line?: ReactNode; price?: Price | null; pill?: ReactNode; tag?: ReactNode; arrow?: boolean;
    cover?: CardCover | null; selected?: boolean; size?: "lg" | "md" | "sm"; label?: string; testId?: string; onClick?: () => void;
  }) {
  const pill = price ? (price.amount ? <>{price.amount.toLocaleString()}<CurrencyIcon currency={price.currency} size={14} /></> : PRICE_TO_COME) : other;
  const face = <>
    {tag ? <span className={f.tag}><Sparkles size={12} aria-hidden />{tag}</span> : null}
    {arrow ? <ArrowUpRight className={f.arrow} size={16} aria-hidden /> : null}
    {typeof picture === "string" ? <PixelImage src={picture} px={px} className={f.cardArt} /> : <span className={f.cardArt} aria-hidden>{picture}</span>}
    <span className={f.cardFoot}>
      <span className={f.cardText}>
        <span className={f.cardName}>{name}</span>
        {line !== undefined ? <span className={f.cardLine}>{line}</span> : null}
      </span>
      {pill !== undefined && pill !== null ? <span className={f.pill}>{pill}</span> : null}
    </span>
    {cover && cover !== "not-found" ? <span className={f.soldOut}>{COVER_TEXT[cover]}</span> : null}
  </>;
  const look = { className: cx(f.card, className), "data-testid": testId, "data-cover": cover || undefined,
    "data-selected": selected || undefined, "data-size": size === "lg" ? undefined : size };
  if (!onClick) return <div {...(rest as HTMLAttributes<HTMLDivElement>)} {...look} role="img" aria-label={label}>{face}</div>;
  // A card that is a radio or a tab (a finish to pick) says so by its role, not as a pressed button.
  return <button type="button" {...rest} {...look} onClick={onClick} aria-label={label} aria-pressed={selected === undefined || rest.role ? undefined : selected}>{face}</button>;
}

/** The small grey pill (a price, a count). */
export function Pill({ children }: { children: ReactNode }) {
  return <span className={f.pill}>{children}</span>;
}

// ── The side panel ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A panel beside a grid (David, round 2: "a lil tab on the side with action item show dont need item open page"; round
 * 3: "make the right tab ui more spacious and less compact, make it a bit bgiger so that theres breathing room and icon
 * can be bigger"): the picture large on the panel's grey, then the quiet kind and the name, a line about it (`text`),
 * what to know (`facts`, hairline rows with room between) and what to do (`actions`); `children` last, for notes. The
 * grid stays in view (`WithSide`); on a phone it sits at the foot of the screen, the picture beside the name.
 */
export function SidePanel({ picture, title, kind, text, facts, actions, children, onClose, testId }: {
  picture?: string | ReactNode; title: ReactNode; kind?: ReactNode; text?: ReactNode; facts?: readonly (readonly [string, ReactNode])[] | null; actions?: ReactNode;
  children?: ReactNode; onClose: () => void; testId?: string;
}) {
  return <aside className={f.sidePanel} aria-label={typeof title === "string" ? title : "Details"} data-testid={testId} data-picture={picture === undefined ? undefined : ""}>
    <button type="button" className={f.sideClose} aria-label="Close" title="Close" onClick={onClose}><X size={18} aria-hidden /></button>
    <div className={f.sideHead}>
      {picture === undefined ? null : <span className={f.sideStage} aria-hidden>{typeof picture === "string" ? <PixelImage src={picture} px={64} /> : picture}</span>}
      <div className={f.sideText}>
        {kind !== undefined ? <p className={f.sideKind}>{kind}</p> : null}
        <h3 className={f.sideTitle}>{title}</h3>
      </div>
    </div>
    {text !== undefined && text !== null && text !== false ? <p className={f.sideBody}>{text}</p> : null}
    {facts && facts.length > 0 ? <dl className={f.facts}>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : null}
    {actions ? <div className={f.sideActions}>{actions}</div> : null}
    {children}
  </aside>;
}

/** A grid with a side panel beside it (`side`, or null when nothing is picked): the grid narrows, it doesn't go away. */
export function WithSide({ side, children }: { side: ReactNode | null; children: ReactNode }) {
  return <div className={f.withSide} data-open={side ? "" : undefined}>
    <div className={f.withSideMain}>{children}</div>
    {side}
  </div>;
}

// ── The detail ──────────────────────────────────────────────────────────────────────────────────────────────────────

type Step = { label: string; onClick: () => void };
/** The detail's action (Buy, Redeem, Craft): the dark pill button. */
export type Action = { label: ReactNode; onClick: () => void; disabled?: boolean };
/**
 * An item opened in the panel: the stage on the left (a `TurnStage`, an `ItemViewer` or a large picture filling
 * `STAGE.stage`) with back, previous and next on it; the info column on the right (`info`, then the price and the
 * action, `pay`, then the fine print, `fine`); the `SpecBand` along the bottom. A priced item with no price yet says
 * "Price to come" and its action is off.
 */
export function DetailView({ stage, onBack, backLabel = "All", steps, hint = "Drag to turn", info, pay, fine, specs, testId }: {
  stage: ReactNode; onBack: () => void; backLabel?: string; steps?: { prev: Step; next: Step } | null; hint?: string | null;
  info: ReactNode; pay?: { price?: Price | null; was?: ReactNode; action?: Action } | null; fine?: ReactNode;
  specs?: readonly (readonly [string, ReactNode])[] | null; testId?: string;
}) {
  return <div className={f.detail} data-testid={testId}>
    <div className={f.stageWrap}>
      {stage}
      <button type="button" className={f.back} onClick={onBack}><ArrowLeft size={16} aria-hidden />{backLabel}</button>
      {steps && <span className={f.steps}>
        <RoundButton label={steps.prev.label} onClick={steps.prev.onClick}><ChevronLeft size={18} aria-hidden /></RoundButton>
        <RoundButton label={steps.next.label} onClick={steps.next.onClick}><ChevronRight size={18} aria-hidden /></RoundButton>
      </span>}
      {hint ? <span className={f.dragHint} aria-hidden>{hint}</span> : null}
    </div>
    <div className={f.info}>
      {info}
      {pay ? <PayRow price={pay.price} was={pay.was} action={pay.action} /> : null}
      {fine !== undefined && fine !== null ? <Fine>{fine}</Fine> : null}
    </div>
    {specs && specs.length > 0 ? <SpecBand specs={specs} /> : null}
  </div>;
}

/** The detail's spec row along the bottom (the lamp reference's ORIGIN / MATERIAL / DESIGNER), in a white band. */
export function SpecBand({ specs }: { specs: readonly (readonly [string, ReactNode])[] }) {
  return <dl className={f.specs}>
    {specs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
  </dl>;
}

/** The info column's head: the small muted kind, the big title, the description. */
export function InfoHead({ kind, title, text }: { kind?: ReactNode; title: ReactNode; text?: ReactNode }) {
  return <>
    {kind !== undefined ? <p className={f.kind}>{kind}</p> : null}
    <h3 className={f.title}>{title}</h3>
    {text !== undefined ? <p className={f.description}>{text}</p> : null}
  </>;
}

/**
 * The price and its action, side by side; `was`: the old price, struck through. A `price` with no amount reads "Price to
 * come", and the action is off until it has one.
 */
export function PayRow({ price, was, action, children }: { price?: Price | null; was?: ReactNode; action?: Action; children?: ReactNode }) {
  return <div className={f.pay}>
    {price ? <span className={f.price}>
      {was !== undefined && was !== null ? <span className={f.was}>{was}</span> : null}
      {price.amount ? <>{price.amount.toLocaleString()}<CurrencyIcon currency={price.currency} size={22} /></> : PRICE_TO_COME}
    </span> : null}
    {action ? <DarkButton disabled={action.disabled || (!!price && !price.amount)} onClick={action.onClick}>{action.label}</DarkButton> : null}
    {children}
  </div>;
}

/** The fine print under the action. */
export function Fine({ children }: { children: ReactNode }) {
  return <p className={f.fine}>{children}</p>;
}

/** Colour dots (the hair dyes, a variant's colours): one chosen, ringed in ink. */
export function ColourDots<T extends string>({ items, value, onPick, label = "Colour" }: {
  items: readonly { id: T; label: string; background: string }[]; value: T; onPick: (id: T) => void; label?: string;
}) {
  return <div className={f.dots} role="radiogroup" aria-label={label}>
    {items.map(d => <button key={d.id} type="button" role="radio" aria-checked={d.id === value} aria-label={d.label} className={f.dot} data-on={d.id === value || undefined}
      style={{ background: d.background }} onClick={() => onPick(d.id)} />)}
  </div>;
}

// ── Buttons ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The dark pill button (Buy, Redeem, Craft); `size="sm"` in a row. */
export function DarkButton({ size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "md" | "sm" }) {
  return <button type="button" {...props} className={cx(size === "sm" ? f.buySmall : f.buy, className)} />;
}
/** The quiet white pill button beside it. */
export function GhostButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className={cx(f.ghost, className)} />;
}
/** A round button: the Tethos navy, white glyphs (as approved on the studio stage). */
export function RoundButton({ label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" {...props} className={cx(f.round, className)} aria-label={label} />;
}

// ── Lists ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Rows split by hairlines, no boxes; `lead`: a quiet line above them. */
export function HairlineRows({ lead, children }: { lead?: ReactNode; children: ReactNode }) {
  return <div className={f.rows}>
    {lead ? <p className={f.lead}>{lead}</p> : null}
    {children}
  </div>;
}
/** One row: an optional picture (a URL gets the pixel finish), the name and a quiet line, and what goes at the end. */
export function HairlineRow({ art, title, detail, end }: { art?: string | ReactNode; title: ReactNode; detail?: ReactNode; end?: ReactNode }) {
  return <div className={f.row}>
    {art === undefined ? null : typeof art === "string" ? <PixelImage src={art} px={28} className={f.rowArt} /> : art}
    <span className={f.rowText}><b>{title}</b>{detail !== undefined ? <span className={f.quiet}>{detail}</span> : null}</span>
    {end}
  </div>;
}
/** Buttons at a row's end. */
export function RowActions({ children }: { children: ReactNode }) {
  return <span className={f.rowActions}>{children}</span>;
}
/** A pickup code, in mono on white. */
export function Code({ children }: { children: ReactNode }) {
  return <span className={f.code} aria-label="Pickup code">{children}</span>;
}

// ── Words ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A quiet line (loading, nothing here yet). */
export function Quiet({ children }: { children: ReactNode }) {
  return <p className={f.quiet}>{children}</p>;
}
/** A status line over the content: what just happened, or what went wrong (`error`). */
export function StatusLine({ error, children }: { error?: boolean; children: ReactNode }) {
  return <p className={error ? f.error : f.note} role="status">{children}</p>;
}

// ── Rewards and moments ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A reward pop (the bible's "big moments are juicy"): a white card that springs in beside the middle of the screen with
 * the real item picture (pixel finish), what happened (`title`: "Caught", "Dug up", "New!"), the name, a quiet line of
 * facts and the one-liner. The edge is the rarity's outline (lib/rarity.ts; divine the moving holo), never a fill. A click
 * puts it away.
 */
export function RewardPop({ picture, title, name, rarity, rarityLabel, facts, note, isNew, leaving, onClose, testId = "reward-card", kind, children }: {
  picture: string; title: ReactNode; name: ReactNode; rarity?: Rarity | null; rarityLabel?: ReactNode; facts?: ReactNode; note?: ReactNode;
  isNew?: boolean; leaving?: boolean; onClose?: () => void; testId?: string; kind?: string; children?: ReactNode;
}) {
  return <article className={f.pop} data-rarity={rarity ?? undefined} data-new={isNew || undefined} data-leaving={leaving || undefined} data-kind={kind}
    onClick={onClose} data-testid={testId}>
    <span className={f.popArt} aria-hidden><PixelImage src={picture} px={72} /></span>
    <span className={f.popText}>
      <span className={f.popTitle}>{isNew && <Sparkles size={13} aria-hidden />}{title}</span>
      <strong className={f.popName}>{name}</strong>
      {(rarityLabel || facts) && <span className={f.popFacts}>{rarityLabel && <span className={f.popRarity}>{rarityLabel}</span>}{facts}</span>}
      {note && <span className={f.popNote}>{note}</span>}
      {children}
    </span>
  </article>;
}

// ── The HUD's bars ──────────────────────────────────────────────────────────────────────────────────────────────────

export type StatKind = "health" | "stamina" | "xp";
const STAT_ICON = { health: Heart, stamina: Zap, xp: Star } as const;

/**
 * One of the player's bars (specs/design-bible.md UI 8, 8b: health, stamina and XP): its icon and a rounded track filled to
 * `value` (0 to 1), then `badge` if any (the level, beside the XP bar in the UI view). The fill eases with a little spring; `snap` sets it without
 * (an XP bar rolling over), `live` drops the ease for a value written every frame through the element's `--v`.
 * `low`: a soft warning (stamina run out). `alone`: on its own little card (stamina, which shows only while it's used).
 */
export function StatBar({ kind, value, label, badge, low, snap, live, alone, shown = true, ref }: {
  kind: StatKind; value: number; label: string; badge?: ReactNode; low?: boolean; snap?: boolean; live?: boolean; alone?: boolean; shown?: boolean; ref?: Ref<HTMLDivElement>;
}) {
  const Icon = STAT_ICON[kind];
  return <div ref={ref} className={f.stat} data-kind={kind} data-low={low || undefined} data-snap={snap || undefined} data-live={live || undefined}
    data-alone={alone || undefined} data-shown={shown || undefined} style={{ "--v": Math.max(0, Math.min(1, value)) } as CSSProperties}
    role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-hidden={!shown || undefined}>
    <span className={f.statLead} aria-hidden><Icon size={13} strokeWidth={2.75} /></span>
    <span className={f.statTrack} aria-hidden><i /></span>
    {badge != null && <span className={f.statBadge} aria-hidden>{badge}</span>}
  </div>;
}

/** The bars' card, top left: one soft white card for the bars that are always on. */
export function StatBars({ children, hidden, className }: { children: ReactNode; hidden?: boolean; className?: string }) {
  return <div className={className ? `${f.stats} ${className}` : f.stats} data-hidden={hidden || undefined} data-testid="hud-bars">{children}</div>;
}

export interface MomentItem { key: string; icon: ReactNode; title: ReactNode; line?: ReactNode }

/**
 * A big moment over the world (a level up): a scrim, one white card that springs in, the kicker, the big number or word
 * with a burst behind it, what it brings (icon rows) and one dark button. Escape, Enter or E, a click on the scrim or
 * the button put it away.
 */
export function BigMoment({ kicker, big, title, items, action = "Nice!", onClose, testId }: {
  kicker: ReactNode; big: ReactNode; title?: ReactNode; items?: readonly MomentItem[]; action?: ReactNode; onClose: () => void; testId?: string;
}) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key.toLowerCase() !== "e") return;
      e.stopPropagation(); e.preventDefault(); close.current();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  return <div className={f.momentLayer} onClick={onClose} data-testid={testId}>
    <section className={f.moment} role="dialog" aria-modal="true" aria-labelledby="moment-big" onClick={e => e.stopPropagation()}>
      <span className={f.momentBurst} aria-hidden>{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ "--k": i } as CSSProperties} />)}</span>
      <span className={f.momentKicker}><Sparkles size={14} aria-hidden />{kicker}</span>
      <strong id="moment-big" className={f.momentBig}>{big}</strong>
      {title && <span className={f.momentTitle}>{title}</span>}
      {items && items.length > 0 && <ul className={f.momentList}>{items.map((it, i) => <li key={it.key} style={{ "--i": i } as CSSProperties}>
        <span className={f.momentIcon} aria-hidden>{it.icon}</span>
        <span><b>{it.title}</b>{it.line && <small>{it.line}</small>}</span>
      </li>)}</ul>}
      <DarkButton onClick={onClose} autoFocus>{action}</DarkButton>
    </section>
  </div>;
}
