"use client";

/**
 * The GUI kit: the flat kit, one look for the member game, the portal and the phone companion (specs/design-bible.md, UI
 * chapter; ledger rows 320, 334 and 335). These are its shared pieces (sheets, buttons, fields, keycaps, the dialogue box,
 * tabs, lists, tiles, badges, progress); components/gui/flat holds the rest. They read the theme's tokens
 * (styles/themes, through styles/game-tokens.css), so a UI pack restyles them whole. There is no other look: recruitment
 * and the applicant island keep theirs in their own code (components/recruit). /lab/gui shows every piece.
 */
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes,
  type InputHTMLAttributes, type KeyboardEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Pointer, X } from "lucide-react";
import { inTopDialog, usePresence, useWorldDialog } from "@/lib/game/useWorldDialog";
import { useMarker } from "./motion";
import styles from "./gui.module.css";
import type { Rarity } from "@/lib/rarity";

/** Toasts: the island's one lane (components/game/ToastHub). `toast(text, icon?)` from anywhere. */
export { default as ToastHub, toast } from "@/components/game/ToastHub";
/** "Sign in" links back to where you are (reachability §3). */
export { SignInLink, SignInText, useSignInHref } from "./SignIn";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// ── Sheets and dialogs ─────────────────────────────────────────────────────────────────────────────────────────────

export type SheetSize = "sm" | "md" | "lg" | "xl";
/**
 * A sheet: the one dialog frame for every menu, one flat light panel. Focus, Escape, its opening key (`keys`), the
 * world's hotkeys held and the paper sound come from the dialog system (lib/game/useWorldDialog); it scales and fades in
 * and out. `modal` false: no scrim, the world stays bright behind it (the decorate panel). On a phone it is a bottom sheet.
 */
export function Sheet({ open, onClose, onEscape, title, eyebrow, icon, size = "md", keys, modal = true, footer, headerExtra, testId, className, bodyClassName, children }: {
  open: boolean; onClose: () => void; title: ReactNode; eyebrow?: ReactNode; icon?: ReactNode; size?: SheetSize;
  keys?: string | readonly string[]; modal?: boolean; footer?: ReactNode; headerExtra?: ReactNode; testId?: string; className?: string; bodyClassName?: string; children: ReactNode;
  /** What Escape (and `keys`) do, when it isn't closing: the game's Esc Menu steps on to Settings. The ✕ and the scrim still close. */
  onEscape?: () => void;
}) {
  const state = usePresence(open);
  const ref = useWorldDialog<HTMLElement>(open, onEscape ?? onClose, keys);
  const titleId = useId();
  // Closing, it keeps what it last showed: callers often clear the item that filled it as they close it.
  const [kept, setKept] = useState({ title, eyebrow, icon, headerExtra, footer, children });
  if (open && (kept.title !== title || kept.eyebrow !== eyebrow || kept.icon !== icon || kept.headerExtra !== headerExtra
    || kept.footer !== footer || kept.children !== children)) setKept({ title, eyebrow, icon, headerExtra, footer, children });
  const shown = open ? { title, eyebrow, icon, headerExtra, footer, children } : kept;
  if (!state) return null;
  return <div className={styles.layer} data-state={state} data-modal={modal || undefined}>
    {modal && <div className={styles.scrim} onClick={onClose} aria-hidden="true" />}
    <section ref={ref} role="dialog" aria-modal={modal} aria-labelledby={titleId} tabIndex={-1} data-gui-dialog data-gui-overlay data-testid={testId}
      className={cx(styles.sheet, className)} data-size={size}>
      <header className={styles.head}>
        {shown.icon && <span className={styles.headIcon} aria-hidden="true">{shown.icon}</span>}
        <div className={styles.headText}>
          {shown.eyebrow && <p className={styles.eyebrow}>{shown.eyebrow}</p>}
          <h2 id={titleId}>{shown.title}</h2>
        </div>
        {shown.headerExtra}
        <IconButton label="Close" size="sm" onClick={onClose} className={styles.close}><X size={18} aria-hidden /></IconButton>
      </header>
      <div className={cx(styles.body, bodyClassName)}>{shown.children}</div>
      {shown.footer && <footer className={styles.foot}>{shown.footer}</footer>}
    </section>
  </div>;
}

/** Are you sure? A small sheet whose safe answer (Cancel) is the default. */
export function ConfirmDialog({ open, title, children, confirmLabel = "Yes", cancelLabel = "Not now", danger, busy, onConfirm, onCancel }: {
  open: boolean; title: ReactNode; children?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return <Sheet open={open} onClose={onCancel} title={title} size="sm" footer={<>
    <Button variant="quiet" size="sm" onClick={onCancel}>{cancelLabel}</Button>
    <Button variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm} disabled={busy}>{busy ? "One moment…" : confirmLabel}</Button>
  </>}>{children && <div className={styles.confirmText}>{children}</div>}</Sheet>;
}

// ── Buttons ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A round button with an icon: its `label` is its name (and its tooltip); `badge` a count on its shoulder. */
export function IconButton({ label, size = "md", badge, tone, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string; size?: "sm" | "md" | "lg"; badge?: number; tone?: "paper" | "sage" | "butter";
}) {
  return <button type="button" aria-label={badge ? `${label}, ${badge}` : label} title={label} {...props} className={cx(styles.iconButton, className)} data-size={size} data-tone={tone}>
    {children}{badge ? <Counter n={badge} className={styles.iconBadge} /> : null}
  </button>;
}

// ── The kit's own button, fields, keycap and dialogue (row 334; design bible UI, "How it's built" 2) ───────────────────

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
/** The kit's button class, for a link that wears it (add `data-variant` and `data-size="sm"` as on a Button). */
export const buttonClass = styles.button;
/** A flat pill: `primary` (the default) on the accent, `secondary` and `quiet` white, `danger` white with the error ink. `leadingKey` shows its key. */
export function Button({ variant = "primary", size, leadingKey, className, children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: "sm"; leadingKey?: string;
}) {
  return <button {...props} type={type} className={cx(styles.button, className)} data-variant={variant} data-size={size}>
    {leadingKey && <Keycap aria-hidden="true">{leadingKey}</Keycap>}{children}
  </button>;
}

/** A key's name on a small ink cap (E, Esc, Shift). */
export function Keycap({ children, className, ...props }: HTMLAttributes<HTMLElement>) {
  return <kbd {...props} className={cx(styles.keycap, className)}>{children}</kbd>;
}

type FieldCopy = { label: ReactNode; hint?: ReactNode; error?: ReactNode };
/** The label, a hint under it, the box on a grey well and what's wrong under that, all tied to the box for screen readers. */
function FieldFrame({ id, label, hint, error, required, className, children }: FieldCopy & { id: string; required?: boolean; className?: string; children: ReactNode }) {
  return <div className={cx(styles.field, className)}>
    <label htmlFor={id}>{label}{required && <span className={styles.required}>Required</span>}</label>
    {hint && <p className={styles.hint} id={`${id}-hint`}>{hint}</p>}
    {children}
    {error && <p className={styles.fieldError} id={`${id}-error`}>{error}</p>}
  </div>;
}
const described = (id: string, own: string | undefined, hint: unknown, error: unknown) => cx(own, !!hint && `${id}-hint`, !!error && `${id}-error`) || undefined;
/** A text field with its label. */
export function Field({ label, hint, error, id, className, "aria-describedby": own, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldCopy) {
  const made = useId(), fieldId = id ?? made;
  return <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={props.required} className={className}>
    <input {...props} id={fieldId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={described(fieldId, own, hint, error)} />
  </FieldFrame>;
}
/** A longer text with its label. */
export function TextArea({ label, hint, error, id, className, rows = 5, "aria-describedby": own, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & FieldCopy) {
  const made = useId(), fieldId = id ?? made;
  return <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={props.required} className={className}>
    <textarea {...props} rows={rows} id={fieldId} aria-invalid={error ? true : props["aria-invalid"]} aria-describedby={described(fieldId, own, hint, error)} />
  </FieldFrame>;
}

/** Someone talking: their name on a tag at the top, the words, and the way on (`onContinue`) with its chevron. */
export function Dialogue({ speaker, children, onContinue, continueLabel = "Got it", className }: { speaker: string; children: ReactNode; onContinue?: () => void; continueLabel?: string; className?: string }) {
  const nameId = useId();
  return <section className={cx(styles.dialogue, className)} aria-labelledby={nameId}>
    <h2 id={nameId} className={styles.speaker}>{speaker}</h2>
    <div className={styles.dialogueText}>{children}</div>
    {onContinue && <button type="button" className={styles.continue} onClick={onContinue}>{continueLabel}<span aria-hidden="true">▾</span></button>}
  </section>;
}

// ── Tabs ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type TabItem<T extends string> = { id: T; label: ReactNode; icon?: ReactNode; badge?: number; disabled?: boolean };
type TabState = { tabs: readonly TabItem<string>[]; value: string; onChange: (id: string) => void };
/** Move the choice `by` tabs (wrapping, skipping disabled ones) and follow it with focus. */
function stepTab(list: HTMLElement | null, { tabs, value, onChange }: TabState, by: number) {
  const usable = tabs.filter(t => !t.disabled), i = usable.findIndex(t => t.id === value), next = usable[(i + by + usable.length) % usable.length];
  if (!next) return;
  onChange(next.id);
  list?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus({ preventScroll: true });
}
/**
 * Text tabs, the chosen one on the accent pill that slides to the next. Arrow keys move between them; inside the top dialog the
 * menu's tab keys ([ and ], remappable) arrive as `tsi:menu-tab`, and `keyHints` shows them at the ends like the
 * kit's L and R.
 */
export function Tabs<T extends string>({ tabs, value, onChange, label, keyHints, className }: {
  tabs: readonly TabItem<T>[]; value: T; onChange: (id: T) => void; label: string; keyHints?: [string, string]; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useRef<TabState>({ tabs, value, onChange: onChange as (id: string) => void });
  useEffect(() => { live.current = { tabs, value, onChange: onChange as (id: string) => void }; });
  // Too many to fit (filter chips on a phone): the row scrolls sideways, its edges fade where more is hidden, and the
  // chosen tab slides into view (reachability §4: the bounty board's chips were cut off at "Complet").
  const [edges, setEdges] = useState<"start" | "end" | "both" | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setEdges(overflowEdges(el.scrollLeft, el.clientWidth, el.scrollWidth));
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", measure); ro?.disconnect(); };
  }, []);
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const el = ref.current, tab = el?.querySelector<HTMLElement>(`[data-tab="${value}"]`);
    if (shown.current !== null && el && tab) revealTab(el, tab);
    shown.current = value;
  }, [value]);
  useEffect(() => {
    const on = (e: Event) => { if (inTopDialog(ref.current)) stepTab(ref.current, live.current, (e as CustomEvent<{ step: number }>).detail.step); };
    window.addEventListener("tsi:menu-tab", on);
    return () => window.removeEventListener("tsi:menu-tab", on);
  }, []);
  const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); stepTab(ref.current, live.current, e.key === "ArrowRight" ? 1 : -1); } };
  // The chosen tab's pill slides to the next one (round 2's micro animations; its own background until measured).
  const pill = useMarker(ref, '[aria-selected="true"]', value);
  return <div className={cx(styles.tabsWrap, className)}>
    {keyHints && <Keycap aria-hidden="true" className={styles.tabKey} data-shape="square">{keyHints[0]}</Keycap>}
    <div ref={ref} role="tablist" aria-label={label} className={styles.tabs} data-edges={edges ?? undefined} data-pill={pill ? "" : undefined} onKeyDown={onKey}>
      {pill ? <span className={styles.tabPill} aria-hidden="true" style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px, ${pill.y}px)` }} /> : null}
      {tabs.map(t => <button key={t.id} type="button" role="tab" data-tab={t.id} aria-selected={t.id === value} tabIndex={t.id === value ? 0 : -1} disabled={t.disabled}
        className={styles.tab} onClick={() => onChange(t.id)}>
        {t.icon && <span className={styles.tabIcon} aria-hidden="true">{t.icon}</span>}<span className={styles.tabLabel}>{t.label}</span>
        {t.badge ? <Counter n={t.badge} /> : null}
      </button>)}
    </div>
    {keyHints && <Keycap aria-hidden="true" className={styles.tabKey} data-shape="square">{keyHints[1]}</Keycap>}
  </div>;
}

/** A tab's content: when the tab changes (`id`), the new content fades in and rises a few px (round 2's micro animations). */
export function TabPanel({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return <div key={id} role="tabpanel" className={cx(styles.tabPanel, className)}>{children}</div>;
}

/** Which ends of a sideways-scrolling row hide more (a pixel or two of slack). */
export function overflowEdges(left: number, width: number, full: number): "start" | "end" | "both" | null {
  const start = left > 2, end = left + width < full - 2;
  return start && end ? "both" : start ? "start" : end ? "end" : null;
}
/** Slide a tab into view inside its row, without moving the page. */
function revealTab(row: HTMLElement, tab: HTMLElement) {
  const l = tab.offsetLeft, r = l + tab.offsetWidth, pad = 24;
  if (l - pad < row.scrollLeft) row.scrollTo({ left: Math.max(0, l - pad), behavior: "smooth" });
  else if (r + pad > row.scrollLeft + row.clientWidth) row.scrollTo({ left: r + pad - row.clientWidth, behavior: "smooth" });
}

// ── Lists and items ─────────────────────────────────────────────────────────────────────────────────────────────────

/** An icon: an image path (a real item icon) or any node. */
function Art({ icon, size = 32 }: { icon: ReactNode | string; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return typeof icon === "string" ? <img src={icon} alt="" width={size} height={size} className={styles.art} /> : <span className={styles.art} aria-hidden="true">{icon}</span>;
}

/**
 * A list row as the shop and recipe lists draw them: icon, name and detail, a dashed leader (`leader`) to the value.
 * `selected`: the butter stripes and the pointing glove. With `onClick` it is a button.
 */
export function ListRow({ icon, title, detail, value, leader, selected, disabled, onClick, className, ...rest }: Omit<HTMLAttributes<HTMLElement>, "title" | "onClick"> & {
  icon?: ReactNode | string; title: ReactNode; detail?: ReactNode; value?: ReactNode; leader?: boolean; selected?: boolean; disabled?: boolean; onClick?: () => void;
}) {
  const body = <>
    {selected && <Pointer className={styles.glove} size={26} aria-hidden="true" />}
    {icon !== undefined && <Art icon={icon} />}
    <span className={styles.rowText}><span className={styles.rowTitle}>{title}</span>{detail && <span className={styles.rowDetail}>{detail}</span>}</span>
    {leader && <span className={styles.leader} aria-hidden="true" />}
    {value !== undefined && <span className={styles.rowValue}>{value}</span>}
  </>;
  const props = { ...rest, className: cx(styles.row, className), "data-selected": selected || undefined, "data-icon": icon !== undefined || undefined, "data-leader": leader || undefined };
  return onClick ? <button type="button" {...props} onClick={onClick} disabled={disabled} aria-pressed={selected}>{body}</button> : <div {...props}>{body}</div>;
}
/** A list of rows with the kit's dashed rules between them. */
export function List({ label, children, className }: { label?: string; children: ReactNode; className?: string }) {
  return <ul className={cx(styles.list, className)} aria-label={label}>{Children.map(children, c => c && <li>{c}</li>)}</ul>;
}

export type { Rarity };
/**
 * An item tile: the real icon on a white card, its stack count, its rarity edge, a dot while it's new. `empty` is a free slot
 * (the kit's little dot, still choosable with `onClick`); `unknown` shows the icon as a silhouette (not found yet).
 * `caption` prints the name below. Without `onClick` it is a picture, not a button.
 */
export function ItemTile({ icon, name, count, rarity, selected, isNew, unknown, empty, caption, size, onClick, className, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  icon?: string | null; name: string; count?: number; rarity?: Rarity; selected?: boolean; isNew?: boolean; unknown?: boolean; empty?: boolean; caption?: ReactNode; size?: number; onClick?: () => void;
}) {
  const style = { ...(size ? { "--tile": `${size}px` } : {}), ...(rarity ? { "--rarity": `var(--gui-rarity-${rarity})` } : {}) } as CSSProperties;
  const label = empty ? "Empty slot" : unknown ? `${name}, not found yet` : `${name}${count && count > 1 ? `, ${count}` : ""}${rarity ? `, ${rarity}` : ""}${isNew ? ", new" : ""}`;
  const face = <>
    {!empty && icon && <Art icon={icon} size={64} />}
    {!empty && !icon && <span className={styles.tileInitial} aria-hidden="true">{name.slice(0, 1)}</span>}
    {!empty && count !== undefined && count > 1 && <b className={styles.count} aria-hidden="true">{count > 999 ? "999+" : count}</b>}
    {isNew && <i className={styles.newDot} aria-hidden="true" />}
  </>;
  const look = { className: cx(styles.tile, className), style, title: empty ? undefined : unknown ? "???" : name, "data-selected": selected || undefined, "data-empty": empty || undefined, "data-unknown": unknown || undefined, "data-rarity": rarity };
  const named = rest["aria-label"] ?? label;
  const tile = onClick
    ? <button type="button" {...rest} {...look} aria-label={named} aria-pressed={!!selected} onClick={onClick}>{face}</button>
    : <span {...look} role="img" aria-label={named}>{face}</span>;
  return caption === undefined ? tile : <span className={styles.tileWithCaption}>{tile}<span className={styles.caption}>{caption}</span></span>;
}

// ── Controls ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** On or off: a switch with its label. */
export function Toggle({ checked, onChange, children, hint, disabled, className }: { checked: boolean; onChange: (on: boolean) => void; children: ReactNode; hint?: ReactNode; disabled?: boolean; className?: string }) {
  const hintId = useId();
  return <button type="button" role="switch" aria-checked={checked} aria-describedby={hint ? hintId : undefined} disabled={disabled} className={cx(styles.toggle, className)} onClick={() => onChange(!checked)}>
    <span className={styles.toggleText}><span>{children}</span>{hint && <small id={hintId}>{hint}</small>}</span>
    <span className={styles.track} aria-hidden="true" />
  </button>;
}

/** A slider with its label and value. */
export function Slider({ label, value, min = 0, max = 100, step = 1, onChange, format = v => String(v), className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "min" | "max"> & {
  label: ReactNode; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const id = useId();
  return <div className={cx(styles.slider, className)}>
    <label htmlFor={id}>{label}</label>
    <input id={id} type="range" min={min} max={max} step={step} value={value} {...rest} onChange={e => onChange(Number(e.target.value))}
      style={{ "--fill": `${((value - min) / (max - min || 1)) * 100}%` } as CSSProperties} aria-valuetext={format(value)} />
    <output htmlFor={id}>{format(value)}</output>
  </div>;
}

/** A native select. */
export function Select({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; children: ReactNode }) {
  const id = useId();
  const select = <select id={id} {...props} className={cx(styles.select, !label && className)}>{children}</select>;
  return label ? <label className={cx(styles.selectRow, className)} htmlFor={id}><span>{label}</span>{select}</label> : select;
}

// ── Badges, counters, progress ──────────────────────────────────────────────────────────────────────────────────────

export type BadgeTone = "neutral" | "sage" | "success" | "warn" | "danger" | "info" | "gold" | "new";
/** A small status tag (the kit's olive "Daily Selection" pill is `gold`). */
export function Badge({ tone = "neutral", children, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span {...rest} className={cx(styles.badge, className)} data-tone={tone}>{children}</span>;
}
export type BadgeRarity = Rarity;
/** A rarity tag in the one rarity palette (--gui-rarity-*, ink text): the catch card, the journal, the book. */
export function RarityBadge({ rarity, children, className, style, ...rest }: HTMLAttributes<HTMLSpanElement> & { rarity: BadgeRarity }) {
  return <span {...rest} className={cx(styles.badge, className)} data-tone="rarity" data-rarity={rarity} style={{ ...style, "--rarity": `var(--gui-rarity-${rarity})` } as CSSProperties}>{children}</span>;
}
/** The red count on a shoulder (unread mail, new items); nothing at zero. */
export function Counter({ n, max = 9, className }: { n: number; max?: number; className?: string }) {
  if (!n) return null;
  return <span className={cx(styles.counter, className)} aria-hidden="true">{n > max ? `${max}+` : n}</span>;
}

export type ProgressKind = "xp" | "mastery" | "ult" | "hp" | "energy" | "plain";
/**
 * Progress in the kit: a soft bar (XP green, mastery gold, HP coral, energy lilac) or, for the ult, a ring that fills
 * clockwise round its icon. `label` names it for screen readers (and shows above the bar with `showLabel`).
 */
export function Progress({ value, max = 1, kind = "plain", label, showLabel, valueText, size, children, className }: {
  value: number; max?: number; kind?: ProgressKind; label: string; showLabel?: boolean; valueText?: string; size?: number; children?: ReactNode; className?: string;
}) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0)) * 100;
  const aria = { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": Math.round(value * 100) / 100, "aria-valuetext": valueText } as const;
  if (kind === "ult") return <span {...aria} className={cx(styles.ring, className)} data-ready={pct >= 100 || undefined}
    style={{ "--value": `${pct * 3.6}deg`, ...(size ? { "--ring": `${size}px` } : {}) } as CSSProperties}>{children}</span>;
  return <div className={cx(styles.progressWrap, className)}>
    {showLabel && <div className={styles.progressLabel}><span>{label}</span>{valueText && <b>{valueText}</b>}</div>}
    <div {...aria} className={styles.progress} data-kind={kind} style={{ "--value": `${pct}%`, ...(size ? { "--h": `${size}px` } : {}) } as CSSProperties}><i /></div>
  </div>;
}

// ── Tooltips, banners, cards ────────────────────────────────────────────────────────────────────────────────────────

/** A teal name pill with a tail, on hover and on keyboard focus; the child is described by it. */
export function Tooltip({ label, place = "top", children }: { label: ReactNode; place?: "top" | "bottom"; children: ReactElement }) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, { "aria-describedby": id }) : children;
  return <span className={styles.tipWrap} data-place={place}>{child}<span role="tooltip" id={id} className={styles.tip}>{label}</span></span>;
}

/** A band over a screen: an icon, a title and a line, on a flat tint (`tone`); `ribbon` a tag at its end (a deadline). */
export function Banner({ title, children, ribbon, icon, tone = "butter", className }: { title: ReactNode; children?: ReactNode; ribbon?: ReactNode; icon?: ReactNode; tone?: "butter" | "sage" | "coral"; className?: string }) {
  return <div className={cx(styles.banner, className)} data-tone={tone}>
    {icon && <span className={styles.bannerIcon} aria-hidden="true">{icon}</span>}
    <div className={styles.bannerText}><h2>{title}</h2>{children && <p>{children}</p>}</div>
    {ribbon && <span className={styles.ribbon}>{ribbon}</span>}
  </div>;
}

/**
 * A white card; `tone` tints it ("paper" is the plain card, the default, kept for the portal pages that name it).
 * `pinned` (with `tilt`) is for paper in the world only (a notice on the board, the club goal): set `data-gui-paper`
 * with it, so it wears paper (styles/paper.css), its pin and its little turn.
 */
export function Card({ tone, pinned, tilt, as: Tag = "div", className, children, style, ...rest }: HTMLAttributes<HTMLElement> & {
  tone?: "paper" | "butter" | "sage" | "warm"; pinned?: boolean; tilt?: number; as?: "div" | "section" | "article" | "li";
}) {
  return <Tag {...rest} className={cx(styles.card, className)} data-tone={tone} data-pinned={pinned || undefined}
    style={tilt ? { ...style, "--tilt": `${tilt}deg` } as CSSProperties : style}>{children}</Tag>;
}

/** A name on a small tag (a speaker, a resident). */
export function NameTag({ children, tone = "coral", className }: { children: ReactNode; tone?: "coral" | "sage" | "paper"; className?: string }) {
  return <span className={cx(styles.nameTag, className)} data-tone={tone}>{children}</span>;
}

// ── Loading and empty ───────────────────────────────────────────────────────────────────────────────────────────────

/** Waiting: three hopping beads and what's happening. */
export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return <div className={cx(styles.loading, className)} role="status" aria-live="polite">
    <span className={styles.beads} aria-hidden="true"><i /><i /><i /></span><span>{label}</span>
  </div>;
}
/** Nothing here yet: a soft drawing, what's missing, and what to do about it. */
export function Empty({ icon, title, children, action, className }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={cx(styles.empty, className)}>
    {icon && <span className={styles.emptyArt} aria-hidden="true">{icon}</span>}
    <p className={styles.emptyTitle}>{title}</p>
    {children && <p className={styles.emptyText}>{children}</p>}
    {action}
  </div>;
}
/** Something went wrong, said plainly, with a way to try again. */
export function ErrorNote({ children, onRetry, className }: { children: ReactNode; onRetry?: () => void; className?: string }) {
  return <div className={cx(styles.errorNote, className)} role="alert">
    <span>{children}</span>{onRetry && <Button variant="quiet" size="sm" onClick={onRetry}>Try again</Button>}
  </div>;
}
