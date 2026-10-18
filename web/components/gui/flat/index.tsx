"use client";

/**
 * The flat UI kit (specs/polish/flat-ui.md, ledger row 315): the shop overlay's pieces (round 4, approved 2026-10-18),
 * shared so the game's menus can wear the same style. One flat light-grey panel over most of the screen (`FlatPanel`):
 * a purse top left, the title, a round close; a rail of icons down the left (`IconRail`); white cards in a grid
 * (`CardGrid`, `ItemCard`); an item opened in the same panel on the white studio stage (`DetailView`, `SpecBand`); and the
 * small parts (`Pill`, `DarkButton`, `GhostButton`, `RoundButton`, `HairlineRow`). Colours: the --flat-* tokens in
 * styles/game-tokens.css. Nothing here knows about the shop: every piece takes plain props.
 */
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode, Ref } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import { CurrencyIcon } from "@/components/economy/Amount";
import PixelImage from "@/components/economy/PixelImage";
import { GuiVariantContext } from "../variant";
import f from "./flat.module.css";

/** The kit's class names, for the odd surface that lays out its own content in the flat style. */
export { f as flatStyles };
/** The detail stage's classes: a viewer (TurnStage, ItemViewer, the keychain's stage) fills `stage`; a picture `picture`. */
export const STAGE = { stage: f.stage, picture: f.stagePicture } as const;

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// ── The panel ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The flat panel: a scrim, one light-grey panel over most of the screen (the whole screen on a phone), a top bar with
 * the purse slot (`purse`), the title and a round close, the rail (`rail`) down the left and the content. Focus,
 * Escape, the opening key (`keys`), the world's hotkeys held and the paper sound come from the dialog system
 * (lib/game/useWorldDialog), as every sheet's do. `embedded`: the same panel on a page (the portal's shop), with no
 * scrim and no dialog; no close without `onClose`.
 */
export function FlatPanel({ open, onClose, title, purse, rail, keys, testId, embedded, children }: {
  open: boolean; onClose?: () => void; title: string;
  /** Top left: the coins and Gems (`Purse`), or anything else short. */
  purse?: ReactNode;
  /** Down the left: an `IconRail`. */
  rail?: ReactNode;
  keys?: string | readonly string[]; testId?: string; embedded?: boolean; children: ReactNode;
}) {
  const state = usePresence(open);
  const panel = useWorldDialog<HTMLElement>(open && !embedded, onClose ?? noop, keys);
  const top = <header className={f.top}>
    {purse ?? <span />}
    <h2 className={f.heading}>{title}</h2>
    {onClose ? <button type="button" className={f.close} aria-label="Close" onClick={onClose}><X size={18} aria-hidden /></button> : <span />}
  </header>;
  // The GUI pieces inside wear the flat look too (components/gui/variant).
  if (embedded) return <GuiVariantContext.Provider value="flat"><section aria-label={title} className={f.panel} data-testid={testId} data-rail={rail ? "" : undefined} data-embedded="" data-gui-flat="">
    {top}{rail}<div className={f.main}>{children}</div>
  </section></GuiVariantContext.Provider>;
  if (!state) return null;
  return <div className={f.layer} data-state={state}>
    <div className={f.scrim} onClick={onClose} aria-hidden="true" />
    <section ref={panel} role="dialog" aria-modal aria-label={title} tabIndex={-1} data-gui-dialog data-gui-overlay className={f.panel} data-testid={testId} data-rail={rail ? "" : undefined} data-gui-flat="">
      <GuiVariantContext.Provider value="flat">
        {top}
        {rail}
        <main className={f.main}>{children}</main>
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
 * Icons only (their labels are for screen readers and the tooltip); the chosen one black with a dot under it, a count
 * badge where `badge` is set. Down the left of a `FlatPanel` (across the top on a phone); `horizontal` puts it across
 * the top anywhere. `tabs`: it is a tab list (a flat `Sheet`'s `Tabs`): role tab, aria-selected, and the caller's
 * `onKeyDown` and `listRef` for the arrow keys.
 */
export function IconRail<T extends string>({ items, value, onChange, label, orientation = "vertical", tabs, listRef, onKeyDown, className }: {
  items: readonly RailItem<T>[]; value: T | null; onChange: (id: T) => void; label: string;
  orientation?: "vertical" | "horizontal"; tabs?: boolean; listRef?: Ref<HTMLElement>; onKeyDown?: (e: KeyboardEvent) => void; className?: string;
}) {
  // A tab list is a div (role tablist); a rail of shelves is the panel's nav.
  const Tag = (tabs ? "div" : "nav") as "nav";
  return <Tag ref={listRef} className={cx(f.side, className)} aria-label={label} role={tabs ? "tablist" : undefined}
    data-orientation={orientation === "horizontal" ? "horizontal" : undefined} onKeyDown={onKeyDown}>
    {items.map(it => {
      const on = it.id === value, badge = badgeText(it.badge);
      return <button key={it.id} type="button" className={f.shelf} aria-label={it.label} title={it.label} disabled={it.disabled}
        {...(tabs ? { role: "tab", "aria-selected": on, tabIndex: on ? 0 : -1, "data-tab": it.id } : { "aria-current": on || undefined })}
        onClick={() => onChange(it.id)}>
        {it.icon}
        {badge ? <span className={f.badge}>{badge}</span> : null}
      </button>;
    })}
  </Tag>;
}

// ── Cards ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A shelf of cards, with its title above. `min`: the narrowest a card gets (px; 250 by default); `phoneMin`: on a phone
 * (one card a row by default, as the shop has it).
 */
export function CardGrid({ title, min, phoneMin, label, children }: { title?: ReactNode; min?: number; phoneMin?: number; label?: string; children: ReactNode }) {
  const style = { ...(min ? { "--card-min": `${min}px` } : {}), ...(phoneMin ? { "--card-min-phone": `${phoneMin}px` } : {}) } as CSSProperties;
  return <>
    {title ? <h3 className={f.shelfTitle}>{title}</h3> : null}
    <div className={f.grid} role={label ? "list" : undefined} aria-label={label} style={min || phoneMin ? style : undefined}>{children}</div>
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
