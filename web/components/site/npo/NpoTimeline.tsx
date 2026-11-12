"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Person } from "../marks";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export type TimelineStop = { when: string; title: string; detail: string; keep?: readonly string[] };

const WIDE = "(min-width: 821px)";

/**
 * The program as one line you walk along. On wide screens the section pins and scrolling slides the stops past a
 * Tethos person standing on the line: the line fills behind them, the stop they reach lights up, and they bob while
 * the page moves. The chips jump to a stop. The last stop opens into what the organization keeps. On narrow screens
 * (and for reduced motion) it is a plain list down the page.
 */
export default function NpoTimeline({ title, stops }: { title: string; stops: readonly TimelineStop[] }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const dots = useRef<number[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = section.current!, tr = track.current!;
    const wide = window.matchMedia(WIDE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let walking = 0;
    const measure = () => { dots.current = Array.from(tr.querySelectorAll<HTMLElement>(".np-tl__stop"), (s) => s.offsetLeft); };
    const apply = (p: number) => {
      const d = dots.current;
      if (!wide.matches || reduce || d.length < 2) { tr.style.transform = ""; tr.style.removeProperty("--fill"); return; }
      const x = d[0] + p * (d[d.length - 1] - d[0]);
      tr.style.transform = `translate3d(${(d[0] - x).toFixed(1)}px, 0, 0)`;
      tr.style.setProperty("--fill", `${x.toFixed(1)}px`);
      let best = 0;
      d.forEach((v, i) => { if (Math.abs(v - x) < Math.abs(d[best] - x)) best = i; });
      setActive(best);
      el.dataset.walking = "true";
      clearTimeout(walking);
      walking = window.setTimeout(() => { el.dataset.walking = "false"; }, 160);
    };
    measure();
    trigger.current = ScrollTrigger.create({ trigger: el, start: "top top", end: "bottom bottom", onUpdate: (s) => apply(s.progress) });
    apply(trigger.current.progress);
    // The stops' places change as fonts and styles land and on resize; measure again whenever the track's size does.
    const onResize = () => { measure(); apply(trigger.current?.progress ?? 0); };
    const ro = new ResizeObserver(onResize);
    ro.observe(tr);
    document.fonts?.ready.then(onResize, () => {});
    return () => { trigger.current?.kill(); ro.disconnect(); clearTimeout(walking); };
  }, []);

  /** Scrolls the page to the point where the walker stands on stop i. */
  const go = (i: number) => {
    const s = trigger.current, d = dots.current;
    if (!s || d.length < 2 || !window.matchMedia(WIDE).matches) {
      section.current?.querySelectorAll(".np-tl__stop")[i]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const y = s.start + ((d[i] - d[0]) / (d[d.length - 1] - d[0])) * (s.end - s.start);
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section ref={section} className="np-tl" data-tone="dark" id="timeline" aria-labelledby="timeline-title" style={{ ["--stops" as string]: stops.length }}>
      <div className="np-tl__stage">
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
        <div className="np-tl__rail">
          <div ref={track} className="np-tl__track">
            <span className="np-tl__line" aria-hidden="true" />
            <span className="np-tl__fill" aria-hidden="true" />
            {stops.map((s, i) => (
              <article key={s.title} className={`np-tl__stop${s.keep ? " np-tl__stop--keep" : ""}`} data-on={active === i || undefined} data-past={active > i || undefined}>
                <span className="np-tl__dot" aria-hidden="true" />
                <p className="np-tl__when">{s.when}</p>
                <h3 className="np-tl__title">{s.title}</h3>
                <p className="np-tl__detail">{s.detail}</p>
                {s.keep && (
                  <ul className="np-tl__keep">
                    {s.keep.map((k) => <li key={k}>{k}</li>)}
                  </ul>
                )}
              </article>
            ))}
          </div>
          <span className="np-tl__walker" aria-hidden="true"><Person /></span>
        </div>
      </div>
    </section>
  );
}
