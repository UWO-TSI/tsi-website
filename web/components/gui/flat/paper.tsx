"use client";

/**
 * Paper, the material (design bible UI 2: only for what is paper in the world), as a folded teahouse menu (David's
 * references, 2026-10-28, specs/references/sushi-menu/; studied, not copied): washi with soft fibre (`--ui-paper-washi`,
 * our texture), ink-black type, the cover's name over a small emblem, a hairline and one quiet line (`CoverTitle`), one red hanko
 * seal (`Hanko`), soft ink-wash art that fades into the paper (`InkArt`: plum, bamboo, pagoda, mist; drawn here as SVG),
 * each dish as a photo with its name, price and what it does beside it (`MenuDish`), and the menu itself, a cover and
 * inner panels that turn like a folded menu (`FoldedMenu`), and its back pages, the tasting book (`BookPage`, a page per
 * water of `BookSlot`s). Shown at /lab/gui?only=flat-pieces. Tokens only.
 */
import { useCallback, useId, useImperativeHandle, useState, type AnimationEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import p from "./paper.module.css";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// ── Ink ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The brush filter (a rough, slightly bled ink edge) under `id`; one per menu. */
export function InkDefs({ id }: { id: string }) {
  return <svg width="0" height="0" aria-hidden style={{ position: "absolute" }}>
    <defs>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={3} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={1.8} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feGaussianBlur in="d" stdDeviation={0.35} />
      </filter>
      <filter id={`${id}-wash`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={3} seed={9} result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale={6} xChannelSelector="R" yChannelSelector="G" result="d" />
        <feGaussianBlur in="d" stdDeviation={1.1} />
      </filter>
    </defs>
  </svg>;
}

const PETALS = [0, 72, 144, 216, 288].map(a => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)] as const);
function Blossom({ x, y, r = 4.4 }: { x: number; y: number; r?: number }) {
  return <g className={p.blossom}>
    {PETALS.map(([c, s], i) => <circle key={i} cx={x + c * r} cy={y + s * r} r={r * 0.95} />)}
    <circle className={p.heart} cx={x} cy={y} r={r * 0.32} />
  </g>;
}

/** Bamboo leaf: a long pointed blade from (x, y) at `deg`, `len` long. */
const leaf = (x: number, y: number, deg: number, len: number, key: number) =>
  <path key={key} d={`M0 0 C ${len * 0.3} ${-len * 0.13} ${len * 0.75} ${-len * 0.1} ${len} 0 C ${len * 0.75} ${len * 0.06} ${len * 0.3} ${len * 0.08} 0 0 Z`}
    transform={`translate(${x} ${y}) rotate(${deg})`} />;

/**
 * Soft ink-wash art, drawn here (no fetched art): a plum branch in blossom, bamboo, a small pagoda in mist, or mist
 * alone. Pale ink, a brushed edge (`filter`, from InkDefs), fading into the paper toward `fade`.
 */
export function InkArt({ kind, filter, fade = "bottom", className }: { kind: "plum" | "bamboo" | "pagoda" | "mist"; filter: string; fade?: "bottom" | "top" | "left" | "right" | "none"; className?: string }) {
  const f = `url(#${filter})`, wash = `url(#${filter}-wash)`;
  let art: ReactNode;
  if (kind === "plum") art = <svg viewBox="0 0 220 300" className={p.art}>
    <g className={p.branch} filter={f}>
      <path strokeWidth={7} opacity={0.5} d="M214 296 C190 250 176 214 150 190 C126 168 104 150 92 118 C82 92 70 70 40 52" />
      <path strokeWidth={2.6} opacity={0.55} d="M214 296 C190 250 176 214 150 190 C126 168 104 150 92 118 C82 92 70 70 40 52" />
      <path strokeWidth={3.4} opacity={0.5} d="M150 190 C128 196 104 206 76 204 M104 150 C120 128 132 110 128 84 M92 118 C70 120 50 112 30 120" />
      <path strokeWidth={1.4} opacity={0.55} d="M76 204 C64 200 56 194 50 184 M128 84 C130 70 138 60 148 52 M40 52 C30 44 22 40 12 40 M30 120 C22 126 16 128 8 128" />
    </g>
    <g filter={f}>
      {[[40, 52], [76, 204], [128, 84], [30, 120], [148, 52], [100, 130, 3.6], [60, 194, 3.4], [116, 102, 3.6], [12, 40, 3], [168, 210, 3.8], [86, 96, 3]].map(([x, y, r], i) => <Blossom key={i} x={x} y={y} r={r} />)}
      {[[52, 184], [8, 128], [138, 66], [182, 232], [120, 198]].map(([x, y], i) => <circle key={i} className={p.bud} cx={x} cy={y} r={2.2} />)}
    </g>
  </svg>;
  else if (kind === "bamboo") art = <svg viewBox="0 0 140 260" className={p.art}>
    <g className={p.wash} filter={f}>
      {[[38, 7, 0], [68, 5, 30], [98, 4, 70]].map(([x, w, top]) => Array.from({ length: Math.floor((260 - top) / 38) + 1 }, (_, i) =>
        <rect key={`${x}-${i}`} x={x} y={top + i * 38} width={w} height={36} rx={w / 2} />))}
      <g opacity={0.9}>{[leaf(42, 60, -28, 46, 1), leaf(42, 62, 200, 40, 2), leaf(72, 104, -12, 44, 3), leaf(72, 106, 212, 36, 4), leaf(101, 146, -34, 38, 5), leaf(70, 36, 196, 42, 6), leaf(40, 140, 18, 40, 7)]}</g>
    </g>
  </svg>;
  else if (kind === "pagoda") art = <svg viewBox="0 0 160 200" className={p.art}>
    <g className={p.wash} filter={f}>
      <path d="M80 6 L80 30" strokeWidth={1.6} className={p.line} />
      {[0, 1, 2, 3, 4].map(i => {
        const y = 40 + i * 30, w = 30 + i * 9, cx0 = 80;
        return <g key={i}>
          <path d={`M${cx0 - w - 6} ${y - 3} C${cx0 - w * 0.6} ${y + 2} ${cx0 - w * 0.3} ${y - 9} ${cx0} ${y - 12} C${cx0 + w * 0.3} ${y - 9} ${cx0 + w * 0.6} ${y + 2} ${cx0 + w + 6} ${y - 3} L${cx0 + w} ${y + 2} L${cx0 - w} ${y + 2} Z`} />
          <rect x={cx0 - w * 0.62} y={y + 2} width={w * 1.24} height={22} opacity={0.6} />
        </g>;
      })}
    </g>
    <g className={p.mist} filter={wash}><ellipse cx={80} cy={190} rx={90} ry={22} /><ellipse cx={30} cy={170} rx={50} ry={14} /><ellipse cx={140} cy={176} rx={46} ry={12} /></g>
  </svg>;
  else art = <svg viewBox="0 0 240 90" className={p.art}>
    <g className={p.haze} filter={wash}><ellipse cx={70} cy={50} rx={80} ry={16} /><ellipse cx={170} cy={58} rx={70} ry={12} /><ellipse cx={120} cy={40} rx={60} ry={9} /></g>
  </svg>;
  return <span className={cx(p.inkArt, className)} data-fade={fade} aria-hidden>{art}</span>;
}

/** The red hanko seal, the menu's one accent: a carved square with a little fish. */
export function Hanko({ size = 34, filter, className }: { size?: number; filter: string; className?: string }) {
  return <svg viewBox="0 0 40 40" width={size} height={size} className={cx(p.hanko, className)} filter={`url(#${filter})`} aria-hidden>
    <rect x={1.5} y={1.5} width={37} height={37} rx={4} className={p.sealInk} />
    <rect x={5} y={5} width={30} height={30} rx={2} className={p.sealCut} fill="none" strokeWidth={1.4} />
    <path className={p.sealFish} d="M10 21 C14 14 23 13 28 19 L33 15 L32 21 L33 27 L28 23 C23 29 14 28 10 21 Z" />
    <circle cx={14.5} cy={20} r={1.2} className={p.sealInk} />
  </svg>;
}

/**
 * The cover's words (round 4, David: the cover "looks crappy"; the references' cover: a small emblem, the name with
 * room round it, a seal, then quiet small words): a thin ink ring with the fish in it, the name in light brushed ink
 * over a pale wash, a hairline with the kind of place and the hanko, and one `line` in the game's voice.
 */
export function CoverTitle({ title, kind, line, filter }: { title: string; kind: string; line: ReactNode; filter: string }) {
  return <div className={p.coverTitle}>
    <svg viewBox="0 0 40 40" className={p.emblem} filter={`url(#${filter})`} aria-hidden>
      <circle cx={20} cy={20} r={17.5} className={p.emblemRing} />
      <path className={p.emblemFish} d="M9 21 C13 14 22 13 27 19 L32 15 L31 21 L32 27 L27 23 C22 29 13 28 9 21 Z" />
    </svg>
    <span className={p.titleWrap}>
      <svg viewBox="0 0 300 60" preserveAspectRatio="none" className={p.swash} filter={`url(#${filter}-wash)`} aria-hidden>
        <path d="M6 34 C40 18 110 22 160 24 C210 26 260 18 294 28 C270 40 210 44 150 42 C90 40 40 46 6 34 Z" />
      </svg>
      <h2 className={p.titleInk} style={{ filter: `url(#${filter})` }}>{title}</h2>
    </span>
    <span className={p.kindRow}><i aria-hidden /><span>{kind}</span><Hanko filter={filter} size={18} /><i aria-hidden /></span>
    <p className={p.coverLine} data-cover-line="">{line}</p>
  </div>;
}

// ── A panel and a dish ──────────────────────────────────────────────────────────────────────────────────────────────

/** A panel's section: its small vertical heading at the top right, on a short hairline, and what's in it. */
export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className={p.section} aria-label={title}>
    <h3 className={p.sectionTitle}>{title}</h3>
    <div className={p.sectionBody}>{children}</div>
  </section>;
}

/** One thing a dish does, as the menu lists it beside the photo: an icon, the words, and how much (`level` of 5 as dots). */
export interface DishStat { icon: ReactNode; label: string; value: ReactNode; level?: number }
/**
 * A dish as the menu shows it (round 4, David: "simple photo of food and then price on the side with like stats"): its
 * photo (the model's icon on a plate, or a marked stand-in), and beside it the name, the price, and what it does, one
 * row a stat. `note`: one quiet line under them. It is the action: picked (`open`), `children` (the order) show under it.
 * Without `onPick` it is no button, only the dish and its `children` (open); on a phone without its photo, as what it is
 * about was picked above it.
 */
export function MenuDish({ picture, name, price, stats, note, standIn, open, disabled, onPick, children }: {
  picture: ReactNode; name: ReactNode; price: ReactNode; stats: readonly DishStat[]; note?: ReactNode; standIn?: boolean; open?: boolean; disabled?: boolean; onPick?: () => void; children?: ReactNode;
}) {
  const face = <>
      <span className={p.photo}>
        <span className={p.plate}>{picture}</span>
        {standIn ? <small className={p.standIn}>stand-in</small> : null}
      </span>
      <span className={p.dishInfo}>
        <span className={p.dishLine}><b>{name}</b><span className={p.dishPrice}>{price}</span></span>
        <span className={p.stats}>
          {stats.map(st => <span key={st.label} className={p.stat}>
            <span className={p.statIcon} aria-hidden>{st.icon}</span>
            <span className={p.statLabel}>{st.label}</span>
            {st.level !== undefined ? <span className={p.dots} aria-hidden>{[1, 2, 3, 4, 5].map(i => <i key={i} data-on={i <= st.level! || undefined} />)}</span> : <span />}
            <span className={p.statValue}>{st.value}</span>
          </span>)}
        </span>
        {note ? <span className={p.dishNote}>{note}</span> : null}
      </span>
  </>;
  return <div className={p.dish} data-open={open || undefined} data-disabled={disabled || undefined}>
    {onPick ? <button type="button" className={p.dishPick} disabled={disabled} aria-expanded={open} onClick={onPick}>{face}</button> : <div className={p.dishPick}>{face}</div>}
    {open || !onPick ? <div className={p.dishAction}>{children}</div> : null}
  </div>;
}

// ── The tasting book (the menu's back pages) ────────────────────────────────────────────────────────────────────────

/** What a book slot holds: nothing yet, or a fish given to Bancha. */
export type BookSlotState = "empty" | "given";
/**
 * One species' slot in the tasting book: an empty one shows the fish as a faint ink shadow, a given one the fish in
 * colour on its plate (round 7, David: "make the fish page not have stamp": the stamps are the collection's track).
 * `fresh`: it was just given (the ink comes in). Hover says what it is.
 */
export function BookSlot({ picture, name, state, fresh }: { picture: ReactNode; name: string; state: BookSlotState; fresh?: boolean }) {
  const label = state === "empty" ? "Not given yet" : `${name}. Given`;
  return <span className={p.slot} data-state={state} data-fresh={fresh || undefined} role="img" aria-label={label} title={label}>
    <span className={p.slotArt}>{picture}</span>
  </span>;
}

/**
 * A stamp in the collection (round 7, David: "the stamp is squre while its circle, also make it look nicer"): a round
 * ink stamp, as a stamp rally's, pressed into the washi: a double ring, the fish, a ripple under it. `turn` tilts it a
 * little, as a hand presses it.
 */
export function Stamp({ filter, turn = 0, className }: { filter: string; turn?: number; className?: string }) {
  return <svg viewBox="0 0 40 40" className={cx(p.stamp, className)} filter={`url(#${filter})`} style={{ rotate: `${turn}deg` }} aria-hidden>
    <circle cx={20} cy={20} r={17.2} className={p.stampLine} strokeWidth={3.2} />
    <circle cx={20} cy={20} r={13.4} className={p.stampLine} strokeWidth={1.1} />
    <path className={p.stampInk} transform="translate(1.5 1.2) scale(0.86)" d="M10 21 C14 14 23 13 28 19 L33 15 L32 21 L33 27 L28 23 C23 29 14 28 10 21 Z" />
    <circle cx={14} cy={18.4} r={1.1} className={p.stampEye} />
    <path className={p.stampLine} strokeWidth={1.4} strokeLinecap="round" d="M13 27.6 q1.75 -1.4 3.5 0 t3.5 0 t3.5 0 t3.5 0" />
  </svg>;
}
/** A hand's tilt for the stamp at `i`, never twice the same in a row. */
const tilt = (i: number) => ((i * 37) % 17) - 8;

/** The page and the book jolting under the stamp's hit. */
const JOLT: [string, Keyframe[], number][] = [
  [p.spread, [{ transform: "none" }, { transform: "translateY(7px) rotate(0.35deg)", offset: 0.12 }, { transform: "translateY(-3px) rotate(-0.15deg)", offset: 0.32 },
    { transform: "translateY(1.5px)", offset: 0.55 }, { transform: "none" }], 460],
  [p.panel, [{ transform: "none" }, { transform: "scale(0.985) translateY(2px)", offset: 0.15 }, { transform: "none" }], 320],
];

/**
 * The stamp coming down on a fresh circle (round 8, David: "make the stamping more dramatic, like comes down like a hard
 * stamp"): the block lifts, slams down fast, squashes on the paper and lifts away; at the hit the ink spreads out, the page
 * and the book jolt and `onLand` runs (the thump). Its shadow on the paper darkens as it falls.
 */
function StampDown({ onLand }: { onLand?: () => void }) {
  const hit = (e: AnimationEvent<HTMLElement>) => {
    for (const [cls, frames, ms] of JOLT) e.currentTarget.closest(`.${cls}`)?.animate(frames, { duration: ms, easing: "ease-out" });
    onLand?.();
  };
  return <>
    <b className={p.stampShade} />
    <b className={p.stampSplat} onAnimationStart={hit} />
    <svg viewBox="0 0 40 72" className={p.stampTool} aria-hidden>
      <rect x={1} y={62} width={38} height={7} rx={1.5} className={p.toolFace} />
      <rect x={2} y={49} width={36} height={14} rx={2.5} className={p.toolWood} />
      <ellipse cx={20} cy={49.5} rx={18} ry={3.5} className={p.toolTop} />
      <rect x={15} y={22} width={10} height={28} className={p.toolWood} />
      <ellipse cx={20} cy={16} rx={10} ry={9} className={p.toolWood} />
      <ellipse cx={16} cy={12} rx={3.5} ry={2.4} className={p.toolShine} />
    </svg>
  </>;
}

/**
 * A collection's permanent boost, as the menu's first page shows it (round 6, David: "make it obvious it s a collection
 * that give [permanent] boosts"): the boost large with its icon, what it is, and a track of `total` circles with
 * `filled` of them stamped, one a fish, to the cap; `fresh`, the last stamp just pressed; `note` under it.
 */
export function BoostTrack({ icon, value, label, filled, total, fresh, note, filter, onLand }: { icon: ReactNode; value: ReactNode; label: ReactNode; filled: number; total: number; fresh?: boolean; note?: ReactNode; filter: string; onLand?: () => void }) {
  return <div className={p.boost} role="group" aria-label={`${value} ${label}, ${filled} of ${total}`}>
    <p className={p.boostValue}><span className={p.boostIcon} aria-hidden>{icon}</span><b>{value}</b><span>{label}</span></p>
    <span className={p.track} aria-hidden>{Array.from({ length: total }, (_, i) => <i key={i} data-on={i < filled || undefined} data-fresh={(fresh && i === filled - 1) || undefined}>
      {i < filled ? <Stamp filter={filter} turn={tilt(i)} /> : null}
      {fresh && i === filled - 1 ? <StampDown onLand={onLand} /> : null}</i>)}</span>
    {note ? <span className={p.boostNote}>{note}</span> : null}
  </div>;
}

/** A fish in the collection: its slot, its name, and what it gave (`gave`, one line; `extra`, a second). */
export function GivenFish({ picture, name, gave, extra, fresh }: { picture: ReactNode; name: string; gave: ReactNode; extra?: ReactNode; fresh?: boolean }) {
  return <figure className={p.given} data-fresh={fresh || undefined}>
    <BookSlot picture={picture} name={name} state="given" fresh={fresh} />
    <figcaption><b>{name}</b><span>{gave}</span>{extra ? <span>{extra}</span> : null}</figcaption>
  </figure>;
}

/** A line on a page that turns to its page (the dishes' contents): a small picture, the name, a quiet second line, and its state at the end. */
export function PaperRow({ art, title, detail, end, onClick }: { art: ReactNode; title: ReactNode; detail?: ReactNode; end?: ReactNode; onClick?: () => void }) {
  const face = <><span className={p.rowArt} aria-hidden>{art}</span><span className={p.rowText}><b>{title}</b>{detail ? <span>{detail}</span> : null}</span>{end ? <span className={p.rowEnd}>{end}</span> : null}</>;
  return onClick ? <button type="button" className={p.row} onClick={onClick}>{face}</button> : <div className={p.row}>{face}</div>;
}

/** A page of the book, one water: its name down the side, how many of its slots are filled, a quiet `note`, the slots. */
export function BookPage({ title, filled, total, note, children }: { title: string; filled: number; total: number; note?: ReactNode; children: ReactNode }) {
  return <PanelSection title={title}>
    <p className={p.bookCount}><b>{filled}</b><span>of {total}</span>{note ? <span className={p.bookNote}>{note}</span> : null}</p>
    <div className={p.slots}>{children}</div>
  </PanelSection>;
}

// ── The folded menu ─────────────────────────────────────────────────────────────────────────────────────────────────

const TURN_MS = 720;
/**
 * A folded menu: closed, its cover; opened, two inner panels side by side, and the next two after a turn. A turn swings
 * the leaf over the fold (the right panel turns over onto the left). The arrows, the arrow keys, and a click on the cover
 * turn it. `panels` go in pairs (left, right). Under reduced motion it turns at once.
 */
/** Turns a FoldedMenu from outside: to a spread (0 the cover, then one a pair of panels). */
export interface FoldedMenuHandle { turn(spread: number): void }
/** The spread panel `i` is on (0 the cover, then one a pair). */
export const spreadOf = (panel: number) => 1 + Math.floor(panel / 2);
/**
 * `chapters` (round 6, David: "the pages need to be reorganized in a userfriendly intuitive way"): under the opened menu,
 * a word for each part (from its first panel) in place of the dots; the part you are in is inked, a click turns to it.
 */
export function FoldedMenu({ cover, panels, label, onTurn, handle, chapters }: { cover: ReactNode; panels: readonly ReactNode[]; label: string; onTurn?: (spread: number) => void; handle?: Ref<FoldedMenuHandle>; chapters?: readonly { label: string; panel: number }[] }) {
  const spreads: [ReactNode, ReactNode][] = [[null, cover]];
  for (let i = 0; i < panels.length; i += 2) spreads.push([panels[i], panels[i + 1] ?? null]);
  const [spread, setSpread] = useState(0), [turn, setTurn] = useState<{ from: number; to: number } | null>(null);
  const go = useCallback((to: number) => {
    if (turn || to < 0 || to >= spreads.length || to === spread) return;
    onTurn?.(to);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setSpread(to); return; }
    setTurn({ from: spread, to });
  }, [turn, spread, spreads.length, onTurn]);
  // The turn ends when the leaf lands (its own animation, not a timer that can beat the last frame).
  const landed = (e: AnimationEvent) => { if (turn && e.target === e.currentTarget) { setSpread(turn.to); setTurn(null); } };
  useImperativeHandle(handle, () => ({ turn: go }), [go]);
  const key = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(spread + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(spread - 1); }
  };
  const fwd = !!turn && turn.to > turn.from;
  const left = turn ? spreads[fwd ? turn.from : turn.to][0] : spreads[spread][0];
  const right = turn ? spreads[fwd ? turn.to : turn.from][1] : spreads[spread][1];
  const closed = (turn ? turn.to : spread) === 0;
  return <div className={p.book} data-closed={closed || undefined} tabIndex={0} onKeyDown={key} role="group" aria-label={label} aria-roledescription="folded menu">
    <div className={p.spread}>
      <div className={p.page} data-side="left">{left ? <Panel side="left">{left}</Panel> : null}</div>
      <div className={p.page} data-side="right">
        {right ? <Panel side="right" cover={!turn && spread === 0} onOpen={!turn && spread === 0 ? () => go(1) : undefined}>{right}</Panel> : null}
      </div>
      {turn ? <div className={p.leaf} data-dir={fwd ? "fwd" : "back"} style={{ animationDuration: `${TURN_MS}ms` }} onAnimationEnd={landed}>
        <div className={p.leafFace}><Panel side="right" cover={(fwd ? turn.from : turn.to) === 0}>{spreads[fwd ? turn.from : turn.to][1]}</Panel></div>
        <div className={p.leafBack}><Panel side="left">{spreads[fwd ? turn.to : turn.from][0]}</Panel></div>
      </div> : null}
    </div>
    {!closed && !turn ? <>
      <button type="button" className={p.turn} data-side="left" aria-label={spread === 1 ? "Close the menu to its cover" : "Turn back"} onClick={() => go(spread - 1)}><ChevronLeft size={18} aria-hidden /></button>
      {spread < spreads.length - 1 ? <button type="button" className={p.turn} data-side="right" aria-label="Turn the page" onClick={() => go(spread + 1)}><ChevronRight size={18} aria-hidden /></button> : null}
    </> : null}
    {chapters && !closed ? <nav className={p.chapters} aria-label="Parts of the menu">{chapters.map((c, i) => {
      const at = spreadOf(c.panel), here = (turn ? turn.to : spread) >= at && (turn ? turn.to : spread) < (chapters[i + 1] ? spreadOf(chapters[i + 1].panel) : Infinity);
      return <button key={c.label} type="button" data-on={here || undefined} aria-current={here ? "page" : undefined} onClick={() => go(at)}>{c.label}</button>;
    })}</nav>
      : !turn ? <span className={p.folio} aria-hidden>{spreads.map((_, i) => <i key={i} data-on={i === spread || undefined} />)}</span> : null}
  </div>;
}

/** One panel of washi: its fold shade on the inner edge; the cover keeps its look as it turns (round 7) and opens on a click. */
function Panel({ side, cover, onOpen, children }: { side: "left" | "right"; cover?: boolean; onOpen?: () => void; children: ReactNode }) {
  if (onOpen) return <button type="button" className={cx(p.panel, p.cover)} data-side={side} onClick={onOpen} aria-label="Open the menu">{children}</button>;
  return <div className={cx(p.panel, cover && p.cover)} data-side={side}>{children}</div>;
}

/** An id for the menu's ink filters. */
export const useInkId = () => `ink-${useId().replace(/:/g, "")}`;
