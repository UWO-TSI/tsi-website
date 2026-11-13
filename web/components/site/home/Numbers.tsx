"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { glitch } from "@/components/site/npo/FaqAscii";
import { NUMBERS } from "@/lib/site/config";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const WIDE = "(min-width: 821px)";
const DIGITS = "0123456789";

/**
 * One number, set huge, every digit a reel: on arrival each digit spins once through 0 to 9 and lands on its own value,
 * the reels a beat apart from left to right; the $, K and + slide up into place.
 */
function Figure({ value, state }: { value: string; state: "before" | "on" | "after" }) {
  return (
    <span className="nm__fig" data-state={state} aria-hidden="true">
      {Array.from(value).map((ch, i) => {
        const d = DIGITS.indexOf(ch);
        return (
          <span key={i} className="nm__reel" style={{ ["--i" as string]: i }} data-digit={d >= 0 || undefined} data-one={d === 1 || undefined}>
            {d >= 0 ? (
              <span className="nm__strip" style={{ ["--to" as string]: 10 + d }}>
                {Array.from(DIGITS + DIGITS.slice(0, d + 1), (g, k) => <span key={k}>{g}</span>)}
              </span>
            ) : (
              <span className="nm__strip"><span>{ch}</span></span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The club in five numbers, one at a time (David, 2026-11-12: "each number should show, like awwwards sites show off
 * numbers"). On wide screens the section pins: scrolling brings each number on stage huge, its digits rolling in like
 * an odometer, its label glitching in and one plain line of what it counts beside it. The rail along the bottom shows
 * where you are, fills as you go and jumps to a number. When the scroll rests between two, it settles on the nearer.
 * Narrow screens and reduced motion get the five stacked, each rolling in as it scrolls into view.
 */
export default function Numbers() {
  const section = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState<boolean[]>(() => NUMBERS.map(() => false));
  const n = NUMBERS.length;

  useEffect(() => {
    const el = section.current!;
    const wide = window.matchMedia(WIDE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let settle = 0;
    const lenis = () => (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
    const toStep = (k: number) => {
      const s = trigger.current;
      if (!s) return;
      const y = s.start + ((k + 0.5) / n) * (s.end - s.start);
      const l = lenis();
      if (l) l.scrollTo(y, { duration: 0.7 }); else window.scrollTo({ top: y, behavior: "smooth" });
    };
    trigger.current = ScrollTrigger.create({
      trigger: el, start: "top top", end: "bottom bottom",
      onUpdate: (s) => {
        if (!wide.matches || reduce) return;
        const f = s.progress * n;
        const k = Math.min(n - 1, Math.floor(f));
        setActive((a) => (a === k ? a : k));
        el.style.setProperty("--step", (f - k).toFixed(3));
        clearTimeout(settle);
        settle = window.setTimeout(() => {
          const t = trigger.current;
          if (!t || !t.isActive) return;
          const g = t.progress * n, kk = Math.min(n - 1, Math.floor(g)), into = g - kk;
          if (into < 0.3 || into > 0.7) toStep(into > 0.7 && kk < n - 1 ? kk + 1 : kk);
        }, 260);
      },
    });
    // Narrow screens: each number rolls in as it scrolls into view.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        const k = Number((e.target as HTMLElement).dataset.k);
        setInView((v) => (v[k] ? v : v.map((x, j) => x || j === k)));
      }
    }, { threshold: 0.5 });
    el.querySelectorAll(".nm__item").forEach((it) => io.observe(it));
    (el as HTMLElement & { __toStep?: (k: number) => void }).__toStep = toStep;
    return () => { clearTimeout(settle); trigger.current?.kill(); io.disconnect(); };
  }, [n]);

  // The label glitches into the next one.
  const shown = useRef(-1);
  useEffect(() => {
    if (shown.current === -1) { shown.current = active; return; }
    if (shown.current === active) return;
    shown.current = active;
    glitch(labelRef.current, NUMBERS[active].label);
  }, [active]);

  const jump = (k: number) => (section.current as (HTMLElement & { __toStep?: (k: number) => void }) | null)?.__toStep?.(k);
  const cur = NUMBERS[active];

  return (
    <section ref={section} className="nm" data-tone="light" id="numbers" aria-labelledby="numbers-title" style={{ ["--n" as string]: n }}>
      <h2 className="ts-visually-hidden" id="numbers-title">Tethos in numbers</h2>
      <div className="nm__stage" aria-hidden="true">
        <div className="ts-wrap nm__grid">
          <p className="nm__count">
            <b>{String(active + 1).padStart(2, "0")}</b> / {String(n).padStart(2, "0")}
          </p>
          <div className="nm__figs">
            {NUMBERS.map((x, k) => <Figure key={x.label} value={x.value} state={k === active ? "on" : k < active ? "after" : "before"} />)}
          </div>
          <div className="nm__about">
            <span ref={labelRef} className="nm__label">{NUMBERS[0].label}</span>
            <p className="nm__line" key={cur.label}>{cur.line}</p>
          </div>
        </div>
        <ol className="ts-wrap nm__rail">
          {NUMBERS.map((x, k) => (
            <li key={x.label}>
              <button type="button" tabIndex={-1} onClick={() => jump(k)} data-on={k === active || undefined} data-past={k < active || undefined}>
                <span className="nm__rail-bar"><i /></span>
                <span className="nm__rail-text"><b>{x.value}</b> {x.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* Narrow screens and reduced motion: all five, stacked. Also what a screen reader reads. */}
      <dl className="ts-wrap nm__list">
        {NUMBERS.map((x, k) => (
          <div key={x.label} className="nm__item" data-k={k}>
            <dt className="nm__label">{x.label}</dt>
            <dd>
              <span className="ts-visually-hidden">{x.value}</span>
              <Figure value={x.value} state={inView[k] ? "on" : "before"} />
              <p className="nm__line">{x.line}</p>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
