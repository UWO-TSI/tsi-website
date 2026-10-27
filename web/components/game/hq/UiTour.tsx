"use client";

/**
 * Alice's UI tour (t-hq): a step at a time over the room, what to press and what to hold, drawn as the keys themselves
 * (a held key sinks and stays down a beat, a pressed one taps), and a ring round where it lives on screen when it's
 * there. The steps and their words: lib/game/arrival/hq/uiTour.ts. `onDone` at the end or on Skip.
 */
import { useLayoutEffect, useMemo, useState } from "react";
import { Hand } from "lucide-react";
import { Button, Keycap } from "@/components/gui";
import { AudioManager } from "@/lib/game/audio";
import { UI_TOUR, tourSteps, type TourKeys } from "@/lib/game/arrival/hq/uiTour";
import s from "./UiTour.module.css";

type Ring = { x: number; y: number; w: number; h: number } | null;

export default function UiTour({ open, keys, touch, onDone }: { open: boolean; keys: TourKeys; touch: boolean; onDone: () => void }) {
  const steps = useMemo(() => tourSteps(keys), [keys]);
  const [i, setI] = useState(0);
  const [ring, setRing] = useState<Ring>(null);
  const step = steps[Math.min(i, steps.length - 1)];
  // Where the step's thing is on screen (if it's showing), kept up with the window's size.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = step.target ? document.querySelector(step.target) : null, r = el?.getBoundingClientRect();
      setRing(r && r.width > 0 && r.height > 0 ? { x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, step]);
  if (!open) return null;
  const last = i >= steps.length - 1;
  const finish = () => { setI(0); onDone(); };
  const go = (d: number) => { AudioManager.playSFX("blip2", { rate: 1.2, gain: 0.35 }); if (d > 0 && last) finish(); else setI(Math.max(0, i + d)); };
  return <div className={`${s.tour} gui`} role="dialog" aria-modal="true" aria-labelledby="ui-tour-title" data-gui-overlay data-testid="ui-tour" data-step={step.id}>
    {ring ? <div className={s.ring} style={{ left: ring.x, top: ring.y, width: ring.w, height: ring.h }} aria-hidden="true" /> : <div className={s.dim} aria-hidden="true" />}
    <section key={step.id} className={s.card}>
      <p className={s.eyebrow}>{UI_TOUR.eyebrow} · {i + 1} / {steps.length}</p>
      <h2 id="ui-tour-title">{step.title}</h2>
      {!touch && step.keys.length > 0 && <div className={s.keys}>
        {step.keys.map(k => <span key={k.key} className={s.press} data-hold={k.hold || undefined}>
          <Keycap aria-hidden="true" className={s.cap}>{k.key}</Keycap>
          <small>{k.hold ? UI_TOUR.hold : UI_TOUR.press}</small>
        </span>)}
      </div>}
      {touch && <div className={s.keys}><span className={s.press} data-hold=""><Hand size={26} aria-hidden className={s.cap} /></span></div>}
      <p className={s.text}>{touch ? step.touch : step.text}</p>
      <div className={s.actions}>
        <Button variant="quiet" size="sm" onClick={finish} data-testid="ui-tour-skip">{UI_TOUR.skip}</Button>
        <span className={s.dots} aria-hidden="true">{steps.map((x, k) => <i key={x.id} data-on={k === i || undefined} />)}</span>
        {i > 0 && <Button variant="secondary" size="sm" onClick={() => go(-1)}>{UI_TOUR.back}</Button>}
        <Button size="sm" onClick={() => go(1)} autoFocus data-testid="ui-tour-next">{last ? UI_TOUR.done : UI_TOUR.next}</Button>
      </div>
    </section>
  </div>;
}
