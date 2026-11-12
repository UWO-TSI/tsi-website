"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AsciiGrain from "../AsciiGrain";
import { Person } from "../marks";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/** `at` is the stop's place in months from August (Aug 0 ... Apr 8); `until` makes it a stretch (the build). */
export type TimelineStop = { when: string; title: string; detail: string; at: number; until?: number; keep?: readonly string[] };

const MONTHS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
const WIDE = "(min-width: 821px)";
// Where the walker stands on screen while the camera follows (a fraction of the width).
const ANCHOR = 0.36;

/**
 * The program as a road you walk along (wide screens). The section pins with its own grain, so the texture holds
 * still while the page scrolls. Scrolling walks a Tethos person along a ruler of months: at first the camera holds
 * and the walker sets off, then the camera follows, and at the end it stops and the walker carries on to the last
 * stop. The line fills behind them, each stop lights up as they reach it (with a hop), the build is a stretch with a
 * marker for every two-weekly demo, and the month they are in stands huge behind it all. They face the way the page
 * moves. Chips jump to a stop. A plain list on narrow screens and for reduced motion.
 */
export default function NpoTimeline({ title, stops }: { title: string; stops: readonly TimelineStop[] }) {
  const section = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const [active, setActive] = useState(-1);
  const [month, setMonth] = useState(0);

  useEffect(() => {
    const el = section.current!, vp = viewport.current!, tr = track.current!;
    const walker = tr.querySelector<HTMLElement>(".np-tl__walker")!;
    const demos = Array.from(tr.querySelectorAll<HTMLElement>(".np-tl__demo"));
    const wide = window.matchMedia(WIDE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let unit = 240, lead = 0, last = 0, still = 0, prevX = 0;

    // The ruler's ticks sit at lead + month * unit, so they give both in real pixels.
    const measure = () => {
      const ticks = tr.querySelectorAll<HTMLElement>(".np-tl__tick");
      if (ticks.length < 2) return;
      lead = ticks[0].offsetLeft;
      unit = ticks[1].offsetLeft - ticks[0].offsetLeft || unit;
    };
    const apply = (p: number) => {
      if (!wide.matches || reduce) { tr.style.transform = ""; return; }
      const x = lead + p * 8 * unit;
      const room = tr.scrollWidth - vp.clientWidth;
      const cam = Math.min(Math.max(0, x - vp.clientWidth * ANCHOR), Math.max(0, room));
      tr.style.transform = `translate3d(${(-cam).toFixed(1)}px, 0, 0)`;
      tr.style.setProperty("--x", `${x.toFixed(1)}px`);
      const m = (x - lead) / unit;
      let reached = -1;
      stops.forEach((s, i) => { if (m >= s.at - 0.02) reached = i; });
      setActive(reached);
      setMonth(Math.min(8, Math.max(0, Math.round(m))));
      demos.forEach((d) => { d.dataset.on = Number(d.dataset.at) <= m ? "true" : "false"; });
      // Walking while the page moves, facing the way it goes.
      if (Math.abs(x - prevX) > 0.5) {
        walker.dataset.dir = x < prevX ? "back" : "on";
        el.dataset.walking = "true";
        clearTimeout(still);
        still = window.setTimeout(() => { el.dataset.walking = "false"; }, 170);
      }
      prevX = x;
      last = p;
    };
    measure();
    trigger.current = ScrollTrigger.create({ trigger: el, start: "top top", end: "bottom bottom", onUpdate: (s) => apply(s.progress) });
    apply(trigger.current.progress);
    const onResize = () => { measure(); apply(trigger.current?.progress ?? last); };
    const ro = new ResizeObserver(onResize);
    ro.observe(vp);
    document.fonts?.ready.then(onResize, () => {});
    return () => { trigger.current?.kill(); ro.disconnect(); clearTimeout(still); };
  }, [stops]);

  // A hop each time the walker reaches a new stop.
  useEffect(() => {
    const w = track.current?.querySelector<HTMLElement>(".np-tl__walker");
    if (!w || active < 0) return;
    w.dataset.hop = "false";
    void w.offsetWidth;
    w.dataset.hop = "true";
  }, [active]);

  /** Scrolls the page to where the walker stands on stop i. */
  const go = (i: number) => {
    const s = trigger.current;
    if (!s || !window.matchMedia(WIDE).matches) {
      section.current?.querySelectorAll(".np-tl__stop")[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const y = s.start + (stops[i].at / 8) * (s.end - s.start) + 2;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  const build = stops.find((s) => s.until !== undefined);
  const demoAt: number[] = [];
  if (build?.until !== undefined) for (let m = build.at + 0.5; m <= build.until + 0.001; m += 0.5) demoAt.push(Math.round(m * 10) / 10);

  return (
    <section ref={section} className="np-tl" data-tone="dark" id="timeline" aria-labelledby="timeline-title">
      <div className="np-tl__stage">
        <AsciiGrain className="np-tl__grain" />
        <p className="np-tl__month" aria-hidden="true" key={month}>{MONTHS[month]}</p>
        <div className="ts-wrap np-tl__head">
          <h2 className="ts-h2" id="timeline-title">{title}</h2>
          <ol className="np-tl__chips" aria-label="Jump to a step">
            {stops.map((s, i) => (
              <li key={s.title}>
                <button type="button" onClick={() => go(i)} aria-current={active === i ? "step" : undefined}>
                  <span>{s.when}</span>{s.title}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div ref={viewport} className="np-tl__viewport">
          <div ref={track} className="np-tl__track">
            <div className="np-tl__ruler" aria-hidden="true">
              {MONTHS.map((m, i) => <span key={m} className="np-tl__tick" style={{ ["--at" as string]: i }} data-past={month >= i || undefined}>{m}</span>)}
            </div>
            <span className="np-tl__line" aria-hidden="true" />
            <span className="np-tl__fill" aria-hidden="true" />
            {build?.until !== undefined && (
              <span className="np-tl__stretch" aria-hidden="true" style={{ ["--at" as string]: build.at, ["--until" as string]: build.until }} />
            )}
            {demoAt.map((m) => (
              <span key={m} className="np-tl__demo" data-at={m} style={{ ["--at" as string]: m }} aria-hidden="true" />
            ))}
            {stops.map((s, i) => (
              <article
                key={s.title}
                className={`np-tl__stop np-tl__stop--${i % 2 ? "below" : "above"}${s.keep ? " np-tl__stop--keep" : ""}`}
                style={{ ["--at" as string]: s.at }}
                data-on={active === i || undefined}
                data-past={active > i || undefined}
              >
                <span className="np-tl__dot" aria-hidden="true" />
                <div className="np-tl__card">
                  <p className="np-tl__when">{s.when}</p>
                  <h3 className="np-tl__title">{s.title}</h3>
                  <p className="np-tl__detail">{s.detail}</p>
                  {s.keep && <ul className="np-tl__keep">{s.keep.map((k) => <li key={k}>{k}</li>)}</ul>}
                </div>
              </article>
            ))}
            <span className="np-tl__walker" aria-hidden="true" data-dir="on">
              <span className="np-tl__walker-body"><Person /></span>
              <span className="np-tl__shadow" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
