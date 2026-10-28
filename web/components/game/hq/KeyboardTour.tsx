"use client";

/**
 * Alice's keyboard tour (David's v2 review): a drawn QWERTY keyboard over the room, built from the GUI kit's keycaps.
 * A step at a time the key you need lights up and you press it, or hold it (a fill runs across the cap), on your real
 * keyboard; there's no Next. Every key you touch sinks on the drawing too. While it's up it takes every key, so nothing
 * opens behind it. The steps and words: lib/game/arrival/hq/uiTour.ts. `onDone` after the last, or on Skip.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check } from "lucide-react";
import { Button, Keycap } from "@/components/gui";
import { AudioManager } from "@/lib/game/audio";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import { HOLD_MS, KEYBOARD, UI_TOUR, tourInput, tourSteps, tourTick, type TourKeys, type TourProgress } from "@/lib/game/arrival/hq/uiTour";
import s from "./KeyboardTour.module.css";

/** A finished step stays lit this long before the next key lights up (ms); the last one, before it closes. */
const NEXT_MS = 650, END_MS = 1100;
const label = (k: string) => KEYBOARD.flat().find(b => b.key === k)?.label || (k === " " ? "Space" : k.length === 1 ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1));

export default function KeyboardTour({ open, keys, onDone }: { open: boolean; keys: TourKeys; onDone: () => void }) {
  const steps = useMemo(() => tourSteps(keys), [keys]);
  const [p, setP] = useState<TourProgress>({ step: 0, holdFrom: null });
  /** The step just finished, lit up a moment before the next (its index), and the keys down now. */
  const [won, setWon] = useState<number | null>(null);
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());
  const live = useRef({ p, won, count: steps.length });
  useEffect(() => { live.current = { p, won, count: steps.length }; }, [p, won, steps.length]);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  const ref = useWorldDialog<HTMLDivElement>(open, () => {}, [], true);
  // A step done: lit a moment, then the next key (or, after the last, the tour closes).
  const complete = useRef((from: number) => {
    setWon(from);
    AudioManager.playSFX("confirm", { rate: 1.15, gain: 0.45 });
    const last = from >= live.current.count - 1;
    window.setTimeout(() => { setWon(null); if (last) { setP({ step: 0, holdFrom: null }); doneRef.current(); } }, last ? END_MS : NEXT_MS);
  });

  // Every key goes to the tour while it's up: the lit one moves it on, the rest only sink on the drawing.
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.type === "keydown") { e.preventDefault(); e.stopImmediatePropagation(); }
      setDown(d => { const n = new Set(d); if (e.type === "keydown") n.add(k); else n.delete(k); return n; });
      if (e.type === "keydown" && !e.repeat) AudioManager.playSFX("keyswitch", { gain: 0.5 });
      const { p: cur, won: w } = live.current;
      if (w !== null) return;
      const next = tourInput(cur, steps, { type: e.type === "keydown" ? "down" : "up", key: k, repeat: e.repeat, at: performance.now() });
      if (next === cur) return;
      setP(next);
      if (next.step > cur.step) complete.current(cur.step);
    };
    const blur = () => setDown(new Set());
    window.addEventListener("keydown", on, true);
    window.addEventListener("keyup", on, true);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", on, true); window.removeEventListener("keyup", on, true); window.removeEventListener("blur", blur); };
  }, [open, steps]);

  // A hold: its fill runs across the cap, and it moves on once it's held long enough.
  useEffect(() => {
    const cap = () => ref.current?.querySelector<HTMLElement>('[data-lit="hold"]');
    if (!open || p.holdFrom === null) { cap()?.style.setProperty("--hold", "0"); return; }
    let raf = 0;
    const tick = () => {
      const now = performance.now(), cur = live.current.p;
      cap()?.style.setProperty("--hold", String(Math.min(1, (now - (cur.holdFrom ?? now)) / HOLD_MS)));
      const next = tourTick(cur, now);
      if (next !== cur) { setP(next); complete.current(cur.step); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, p.holdFrom, ref]);

  if (!open) return null;
  const shown = won ?? Math.min(p.step, steps.length - 1), step = steps[shown];
  const skip = () => { setP({ step: 0, holdFrom: null }); setWon(null); onDone(); };
  return <div ref={ref} tabIndex={-1} className={`${s.tour} gui`} role="dialog" aria-modal="true" aria-labelledby="key-tour-title" data-gui-overlay data-testid="ui-tour" data-step={step.id} data-won={won !== null || undefined}>
    <section className={s.panel}>
      <header key={step.id} className={s.head}>
        <p className={s.eyebrow}>{UI_TOUR.eyebrow} · {shown + 1} / {steps.length}</p>
        <h2 id="key-tour-title">{step.title}</h2>
        <p className={s.ask} aria-live="polite">
          {won !== null ? <><Check size={18} aria-hidden /> {won >= steps.length - 1 ? UI_TOUR.done : "Nice"}</>
            : <>{step.hold ? UI_TOUR.hold : UI_TOUR.press} <Keycap className={s.askCap}>{label(step.key)}</Keycap></>}
        </p>
        <p className={s.text}>{step.text}</p>
      </header>
      <div className={s.board} aria-hidden="true">
        {KEYBOARD.map((row, r) => <div key={r} className={s.row}>
          {row.map(b => {
            const lit = b.key === step.key, base = b.key.replace(/-r$/, "");
            return <Keycap key={b.key} className={s.key} style={{ "--w": b.w ?? 1 } as CSSProperties}
              data-lit={lit && won === null ? (step.hold ? "hold" : "press") : undefined} data-won={lit && won !== null || undefined}
              data-done={steps.slice(0, p.step).some(x => x.key === b.key) && !lit || undefined} data-down={down.has(base) || undefined}>
              {b.label}{lit && step.hold && <i className={s.fill} />}
            </Keycap>;
          })}
        </div>)}
      </div>
      <div className={s.foot}>
        <span className={s.dots} aria-hidden="true">{steps.map((x, i) => <i key={x.id} data-on={i === shown || undefined} data-done={i < p.step || undefined} />)}</span>
        <Button variant="quiet" size="sm" onClick={skip} data-testid="ui-tour-skip">{UI_TOUR.skip}</Button>
      </div>
    </section>
  </div>;
}
