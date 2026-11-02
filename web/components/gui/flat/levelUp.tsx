"use client";

/**
 * A level up as a moment (specs/design-bible.md UI 4; David's r3 review: "level up card should feel mor oomph, more juice,
 * suspense ... maybe have your character model there and like the experience floats into the character and flash frame
 * for every experence going in and it has level up animation and the text that says level up and the character jumps and
 * grows a lil and next fram over lay the level upgrade and the things you unlock"). Three beats on one white card:
 * - charge: the `figure` (the game's 3D character) on a soft glow; XP motes curve in from around it, and each one landing
 *   flashes the figure white for two frames (never back to back: they land `LEVEL_UP_MS.gap` apart) and calls `onBeat`;
 * - burst: "Level up!" springs out with a burst of sparks, the figure grows a little (the host makes it jump);
 * - reveal: the new level and what it unlocks slide up over the figure's lower half, with one dark button.
 * Reduced motion starts at the reveal (no motes, no flashes). A click, E, Enter or Escape skips to the reveal, then closes.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import f from "./flat.module.css";
import l from "./levelUp.module.css";

export interface MomentItem { key: string; icon: ReactNode; title: ReactNode; line?: ReactNode }
export type LevelBeat = "mote" | "burst" | "reveal";

const MOTES = 7;
/** The beats, in ms from the start: the motes' first flight, each flight, the gap between landings, the burst, the reveal. */
export const LEVEL_UP_MS = (() => {
  const start = 350, fly = 560, gap = 180, burst = start + fly + (MOTES - 1) * gap + 260;
  return { start, fly, gap, burst, reveal: burst + 1050 };
})();
/** Where each mote starts, round the figure's middle (golden-angle spaced, so they never queue up on one side). */
const FROM = Array.from({ length: MOTES }, (_, i) => {
  const a = 0.6 + i * 2.39996, r = 140 + (i % 3) * 20;
  return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r * 0.85) };
});

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function LevelUpMoment({ level, figure, title, items, action = "Nice!", onBeat, onClose, testId }: {
  level: number; figure?: ReactNode; title?: ReactNode; items?: readonly MomentItem[]; action?: ReactNode;
  onBeat?: (beat: LevelBeat, i: number) => void; onClose: () => void; testId?: string;
}) {
  const [phase, setPhase] = useState<"charge" | "burst" | LevelBeat>(() => (reduced() ? "reveal" : "charge"));
  const figureEl = useRef<HTMLDivElement>(null);
  const beat = useRef(onBeat), close = useRef(onClose), at = useRef(phase);
  useEffect(() => { beat.current = onBeat; close.current = onClose; at.current = phase; });
  const go = (p: LevelBeat) => { if (at.current === "reveal") return; at.current = p; setPhase(p); beat.current?.(p, 0); };
  const next = useRef(() => { if (at.current === "reveal") close.current(); else go("reveal"); });
  useEffect(() => {
    if (at.current === "reveal") { beat.current?.("reveal", 0); return; }
    const t = [window.setTimeout(() => go("burst"), LEVEL_UP_MS.burst), window.setTimeout(() => go("reveal"), LEVEL_UP_MS.reveal)];
    return () => t.forEach(x => window.clearTimeout(x));
  }, []);
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Enter" && e.key.toLowerCase() !== "e") return;
      e.stopPropagation(); e.preventDefault(); next.current();
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  /** A mote landed: the figure flashes white for two frames. */
  const landed = (i: number) => {
    const el = figureEl.current;
    if (!el) return;
    el.dataset.flash = "";
    requestAnimationFrame(() => requestAnimationFrame(() => { delete el.dataset.flash; }));
    beat.current?.("mote", i);
  };
  return <div className={l.layer} onClick={() => next.current()} data-testid={testId} data-phase={phase}>
    <section className={l.card} role="dialog" aria-modal="true" aria-label={`Level up: level ${level}`} data-phase={phase}
      style={{ "--start": `${LEVEL_UP_MS.start}ms`, "--fly": `${LEVEL_UP_MS.fly}ms`, "--gap": `${LEVEL_UP_MS.gap}ms`, "--charge": `${LEVEL_UP_MS.burst - LEVEL_UP_MS.start}ms` } as CSSProperties}>
      <div className={l.stage}>
        <span className={l.glow} aria-hidden />
        <div ref={figureEl} className={l.figure}>{figure}</div>
        {phase === "charge" && <span className={l.motes} aria-hidden>{FROM.map((p, i) =>
          <span key={i} className={l.moteX} style={{ "--i": i, "--x": `${p.x}px`, "--y": `${p.y}px` } as CSSProperties} onAnimationEnd={e => e.target === e.currentTarget && landed(i)}>
            <span className={l.moteY}><i /></span>
          </span>)}</span>}
        {phase !== "charge" && <span className={l.sparks} aria-hidden>{Array.from({ length: 12 }, (_, k) => <i key={k} style={{ "--k": k } as CSSProperties} />)}</span>}
        {phase !== "charge" && <strong className={l.shout} aria-hidden><Sparkles size={20} />Level up!</strong>}
      </div>
      {phase === "reveal" && <div className={l.panel} onClick={e => e.stopPropagation()}>
        <span className={l.kicker}>Level up</span>
        <strong className={l.big}><small>Lv</small>{level}</strong>
        {title && <span className={l.title}>{title}</span>}
        {items && items.length > 0 && <ul className={l.list}>{items.map((it, i) => <li key={it.key} style={{ "--i": i } as CSSProperties}>
          <span className={l.icon} aria-hidden>{it.icon}</span>
          <span><b>{it.title}</b>{it.line && <small>{it.line}</small>}</span>
        </li>)}</ul>}
        <button type="button" className={f.buy} onClick={onClose} autoFocus>{action}</button>
      </div>}
    </section>
  </div>;
}
