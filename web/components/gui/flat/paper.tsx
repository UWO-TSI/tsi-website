"use client";

/**
 * Paper, the material (design bible UI 2: only for what is paper in the world), as a folded teahouse menu (David's
 * references, 2026-10-28, specs/references/sushi-menu/; studied, not copied): washi with soft fibre (`--ui-paper-washi`,
 * our texture), ink-black type with a vertical brush-style title (`InkTitle`), one red hanko seal (`Hanko`), soft
 * ink-wash art that fades into the paper (`InkArt`: plum, bamboo, pagoda, mist; drawn here as SVG), dishes on a lacquer
 * tray and plate with their names and small prices on hairline rules (`TrayDish`), and the menu itself, a cover and
 * inner panels that turn like a folded menu (`FoldedMenu`). Shown at /lab/gui?only=flat-pieces. Tokens only.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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

/** A vertical brush-style title (writing top to bottom, the game's type with a brushed ink edge) beside small horizontal text. */
export function InkTitle({ title, side, filter }: { title: string; side?: ReactNode; filter: string }) {
  return <div className={p.title}>
    <span className={p.titleWrap}>
      <svg viewBox="0 0 60 300" preserveAspectRatio="none" className={p.swash} filter={`url(#${filter}-wash)`} aria-hidden>
        <path d="M30 4 C44 10 47 40 44 80 C41 130 47 180 42 230 C39 262 36 286 27 296 C22 286 20 260 18 230 C14 180 18 120 15 80 C13 44 16 12 30 4 Z" />
      </svg>
      <h2 className={p.titleInk} style={{ filter: `url(#${filter})` }}>{title}</h2>
    </span>
    {side ? <><i className={p.titleRule} aria-hidden /><p className={p.titleSide}>{side}</p></> : null}
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

/**
 * A dish on a lacquer tray and a plate (its picture: the model's icon, or a marked stand-in), its name and small price on
 * a hairline rule. Hovered or focused, one quiet line of what it does (David: "hover over dishes show what they do").
 * It is the action: picked (`open`), `children` (the order) show under it.
 */
export function TrayDish({ picture, name, price, does, standIn, open, disabled, onPick, children }: {
  picture: ReactNode; name: ReactNode; price: ReactNode; does: ReactNode; standIn?: boolean; open?: boolean; disabled?: boolean; onPick?: () => void; children?: ReactNode;
}) {
  return <div className={p.dish} data-open={open || undefined} data-disabled={disabled || undefined}>
    <button type="button" className={p.dishPick} disabled={disabled} aria-expanded={open} onClick={onPick}>
      <span className={p.tray} aria-hidden>
        <i className={p.chopsticks} />
        <span className={p.plate}>{picture}</span>
        {standIn ? <small className={p.standIn}>stand-in</small> : null}
      </span>
      <span className={p.dishLine}><b>{name}</b><span className={p.dishPrice}>{price}</span></span>
      <span className={p.dishDoes}>{does}</span>
    </button>
    {open ? <div className={p.dishAction}>{children}</div> : null}
  </div>;
}

// ── The folded menu ─────────────────────────────────────────────────────────────────────────────────────────────────

const TURN_MS = 720;
/**
 * A folded menu: closed, its cover; opened, two inner panels side by side, and the next two after a turn. A turn swings
 * the leaf over the fold (the right panel turns over onto the left). The arrows, the arrow keys, and a click on the cover
 * turn it. `panels` go in pairs (left, right). Under reduced motion it turns at once.
 */
export function FoldedMenu({ cover, panels, label, onTurn }: { cover: ReactNode; panels: readonly ReactNode[]; label: string; onTurn?: (spread: number) => void }) {
  const spreads: [ReactNode, ReactNode][] = [[null, cover]];
  for (let i = 0; i < panels.length; i += 2) spreads.push([panels[i], panels[i + 1] ?? null]);
  const [spread, setSpread] = useState(0), [turn, setTurn] = useState<{ from: number; to: number } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const go = useCallback((to: number) => {
    if (turn || to < 0 || to >= spreads.length || to === spread) return;
    onTurn?.(to);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setSpread(to); return; }
    setTurn({ from: spread, to });
    timer.current = window.setTimeout(() => { setSpread(to); setTurn(null); }, TURN_MS);
  }, [turn, spread, spreads.length, onTurn]);
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
        {right ? <Panel side="right" cover={!turn && spread === 0} onOpen={() => go(1)}>{right}</Panel> : null}
      </div>
      {turn ? <div className={p.leaf} data-dir={fwd ? "fwd" : "back"} style={{ animationDuration: `${TURN_MS}ms` }}>
        <div className={p.leafFace}><Panel side="right">{spreads[fwd ? turn.from : turn.to][1]}</Panel></div>
        <div className={p.leafBack}><Panel side="left">{spreads[fwd ? turn.to : turn.from][0]}</Panel></div>
      </div> : null}
    </div>
    {!closed && !turn ? <>
      <button type="button" className={p.turn} data-side="left" aria-label={spread === 1 ? "Close the menu to its cover" : "Turn back"} onClick={() => go(spread - 1)}><ChevronLeft size={18} aria-hidden /></button>
      {spread < spreads.length - 1 ? <button type="button" className={p.turn} data-side="right" aria-label="Turn the page" onClick={() => go(spread + 1)}><ChevronRight size={18} aria-hidden /></button> : null}
    </> : null}
    {!turn ? <span className={p.folio} aria-hidden>{spreads.map((_, i) => <i key={i} data-on={i === spread || undefined} />)}</span> : null}
  </div>;
}

/** One panel of washi: its fold shade on the inner edge; the cover opens on a click. */
function Panel({ side, cover, onOpen, children }: { side: "left" | "right"; cover?: boolean; onOpen?: () => void; children: ReactNode }) {
  if (cover) return <button type="button" className={cx(p.panel, p.cover)} data-side={side} onClick={onOpen} aria-label="Open the menu">{children}</button>;
  return <div className={p.panel} data-side={side}>{children}</div>;
}

/** An id for the menu's ink filters. */
export const useInkId = () => `ink-${useId().replace(/:/g, "")}`;
