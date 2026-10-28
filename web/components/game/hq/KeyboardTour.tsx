"use client";

/**
 * Alice's keyboard tour (David's v2 review): the kit's drawn keyboard (components/gui/flat KeyBoard) in a Spotlight
 * over the room. A step at a time the key you need lights up and you press it, or hold it (a fill runs across the
 * key), on your real keyboard; there's no Next. Every key you touch sinks on the drawing too. While it's up it takes
 * every key, so nothing opens behind it. The steps and words: lib/game/arrival/hq/uiTour.ts. `onDone` after the last,
 * or on Skip.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Keycap } from "@/components/gui";
import { GhostButton, KeyBoard, Spotlight, boardLabel } from "@/components/gui/flat";
import { AudioManager } from "@/lib/game/audio";
import { HOLD_MS, UI_TOUR, tourInput, tourSteps, tourTick, type TourKeys, type TourProgress } from "@/lib/game/arrival/hq/uiTour";

/** A finished step stays lit this long before the next key lights up (ms); the last one, before it closes. */
const NEXT_MS = 650, END_MS = 1100;
const START: TourProgress = { step: 0, holdFrom: null };

export default function KeyboardTour({ open, keys, onDone }: { open: boolean; keys: TourKeys; onDone: () => void }) {
  const steps = useMemo(() => tourSteps(keys), [keys]);
  const [p, setP] = useState<TourProgress>(START);
  /** The step just finished, lit up a moment before the next; the keys down now; a hold's fill (0 to 1). */
  const [won, setWon] = useState<number | null>(null);
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());
  const [fill, setFill] = useState(0);
  const live = useRef({ p, won, count: steps.length });
  useEffect(() => { live.current = { p, won, count: steps.length }; }, [p, won, steps.length]);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);
  // A step done: lit a moment, then the next key (or, after the last, the tour closes).
  const complete = useRef((from: number) => {
    setWon(from); setFill(0);
    AudioManager.playSFX("confirm", { rate: 1.15, gain: 0.45 });
    const last = from >= live.current.count - 1;
    window.setTimeout(() => { setWon(null); if (last) { setP(START); doneRef.current(); } }, last ? END_MS : NEXT_MS);
  });

  // Every key goes to the tour while it's up: the lit one moves it on, the rest only sink on the drawing.
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), isDown = e.type === "keydown";
      if (isDown) { e.preventDefault(); e.stopImmediatePropagation(); }
      setDown(d => { const n = new Set(d); if (isDown) n.add(k); else n.delete(k); return n; });
      if (isDown && !e.repeat) AudioManager.playSFX("keyswitch", { gain: 0.5 });
      const { p: cur, won: w } = live.current;
      if (w !== null) return;
      const next = tourInput(cur, steps, { type: isDown ? "down" : "up", key: k, repeat: e.repeat, at: performance.now() });
      if (next === cur) return;
      setP(next);
      if (next.holdFrom === null) setFill(0);
      if (next.step > cur.step) complete.current(cur.step);
    };
    const blur = () => setDown(new Set());
    window.addEventListener("keydown", on, true);
    window.addEventListener("keyup", on, true);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", on, true); window.removeEventListener("keyup", on, true); window.removeEventListener("blur", blur); };
  }, [open, steps]);

  // A hold: its fill runs across the key, and it moves on once it's held long enough.
  useEffect(() => {
    if (!open || p.holdFrom === null) return;
    let raf = 0;
    const tick = () => {
      const now = performance.now(), cur = live.current.p;
      setFill(Math.min(1, (now - (cur.holdFrom ?? now)) / HOLD_MS));
      const next = tourTick(cur, now);
      if (next !== cur) { setP(next); complete.current(cur.step); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, p.holdFrom]);

  const shown = won ?? Math.min(p.step, steps.length - 1), step = steps[shown];
  const lead = won !== null ? <><Check size={20} aria-hidden /> {won >= steps.length - 1 ? UI_TOUR.done : UI_TOUR.nice}</>
    : <>{step.hold ? UI_TOUR.hold : UI_TOUR.press} <Keycap>{boardLabel(step.key)}</Keycap></>;
  return <Spotlight open={open} label={step.title} eyebrow={`${UI_TOUR.eyebrow} · ${shown + 1} / ${steps.length}`} title={step.title} lead={lead} text={step.text}
    steps={{ count: steps.length, at: shown }} testId="ui-tour" dataset={{ "data-step": step.id, "data-won": won !== null ? "" : undefined }}
    footer={<GhostButton onClick={() => { setP(START); setWon(null); onDone(); }} data-testid="ui-tour-skip">{UI_TOUR.skip}</GhostButton>}>
    <KeyBoard lit={step.key} hold={step.hold} fill={fill} won={won !== null} done={steps.slice(0, p.step).map(s => s.key)} down={down} />
  </Spotlight>;
}
