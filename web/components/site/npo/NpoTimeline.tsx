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
const MONTH_NAMES = ["AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER", "JANUARY", "FEBRUARY", "MARCH", "APRIL"];
const WIDE = "(min-width: 821px)";
// Where the walker stands on screen while the camera follows (a fraction of the width).
const ANCHOR = 0.36;
const CELL_W = 7;
const CELL_H = 12;
const GLYPH_ALPHA = 0.13;
const MORPH_MS = 700;
const NOISE = "#%&*+=01<>/";
const CONFETTI = ["#1d9bf0", "#f1ffff", "#8fd0ff", "#4cb1f4", "#c9e9ff"];

/**
 * The month the walker is in, built out of characters (the site's 7 x 12 cell) and spelled in its full name. When
 * the month changes, every cell glitches across at its own moment from the old letters to the new ones.
 */
function MonthGlyph({ month }: { month: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const shown = useRef<{ mask: Float32Array; month: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const cols = Math.floor(w / CELL_W), rows = Math.floor(h / CELL_H);

    // How much of each cell the month's three letters cover, from the letters drawn big and sampled per cell.
    const maskFor = (m: number) => {
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      const label = MONTHS[m].toUpperCase();
      let size = h * 1.08;
      g.font = `700 ${size}px Sohne, "Inter Tight", system-ui, sans-serif`;
      const tw = g.measureText(label).width;
      if (tw > w * 0.98) { size *= (w * 0.98) / tw; g.font = `700 ${size}px Sohne, "Inter Tight", system-ui, sans-serif`; }
      g.textAlign = "right"; g.textBaseline = "alphabetic"; g.fillStyle = "#fff";
      g.fillText(label, w, h * 0.96);
      const px = g.getImageData(0, 0, w, h).data;
      const mask = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
          const x = Math.floor(c * CELL_W + (i + 0.5) * CELL_W / 2), y = Math.floor(r * CELL_H + (j + 0.5) * CELL_H / 2);
          sum += px[(y * w + x) * 4 + 3] / 255;
        }
        mask[r * cols + c] = sum / 4;
      }
      return mask;
    };

    const font = `500 ${CELL_H - 2}px "Sohne Mono", ui-monospace, monospace`;
    const paint = (from: { mask: Float32Array; month: number } | null, to: { mask: Float32Array; month: number }, t: number, switchAt: Float32Array) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#f1ffff";
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const at = switchAt[i];
        const before = from && t < at - 70, glitching = from && Math.abs(t - at) <= 70;
        const src = before ? from! : to;
        const cover = glitching ? Math.max(from!.mask[i], to.mask[i]) : src.mask[i];
        if (cover < 0.2) continue;
        const name = MONTH_NAMES[src.month] + " ";
        const ch = glitching ? NOISE[Math.floor(Math.random() * NOISE.length)] : name[(c + r * 3) % name.length];
        ctx.globalAlpha = glitching ? 0.42 : GLYPH_ALPHA * Math.min(1, cover * 1.4);
        ctx.fillText(ch, c * CELL_W + CELL_W / 2, r * CELL_H + CELL_H / 2);
      }
      ctx.globalAlpha = 1;
    };

    const next = { mask: maskFor(month), month };
    const prev = shown.current && shown.current.mask.length === next.mask.length ? shown.current : null;
    const switchAt = Float32Array.from({ length: cols * rows }, () => Math.random() * (MORPH_MS - 140) + 70);
    shown.current = next;
    if (!prev || reduce) { paint(null, next, 0, switchAt); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = now - t0;
      paint(prev, next, t, switchAt);
      if (t < MORPH_MS) raf = requestAnimationFrame(step);
      else paint(null, next, MORPH_MS, switchAt);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [month]);

  return <canvas ref={ref} className="np-tl__glyph" aria-hidden="true" />;
}

/** Confetti out of the walker when they reach the end: paper and characters, thrown up, falling and fading. */
function burst(canvas: HTMLCanvasElement, x: number, y: number) {
  const ctx = canvas.getContext("2d")!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  const bits = Array.from({ length: 110 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.1, s = 320 + Math.random() * 620;
    return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)], ch: Math.random() < 0.3 ? NOISE[Math.floor(Math.random() * NOISE.length)] : "" };
  });
  const t0 = performance.now();
  let last = t0;
  const step = (now: number) => {
    const dt = Math.min(0.033, (now - last) / 1000), t = (now - t0) / 1000;
    last = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bits) {
      b.vy += 1100 * dt; b.vx *= 0.985; b.vy *= 0.985;
      b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
      ctx.setTransform(dpr, 0, 0, dpr, b.x * dpr, b.y * dpr);
      ctx.rotate(b.r);
      ctx.globalAlpha = Math.max(0, Math.min(1, (2.4 - t) / 0.7));
      ctx.fillStyle = b.color;
      if (b.ch) { ctx.font = `600 13px "Sohne Mono", ui-monospace, monospace`; ctx.fillText(b.ch, -4, 4); }
      else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 1.7)) + 1);
    }
    if (t < 2.4) requestAnimationFrame(step);
    else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  };
  requestAnimationFrame(step);
}

/**
 * The program as a road you walk along (wide screens). The section pins with its own grain, so the texture holds
 * still while the page scrolls. Scrolling walks a Tethos person along a ruler of months: at first the camera holds
 * and the walker sets off, then the camera follows, and at the end it stops and the walker carries on to the finish
 * flag, where confetti goes up. The road fills behind them and runs dashed ahead; each stop's panel lights up as they
 * reach it (with a hop), the build is a stretch with a marker for every two-weekly demo, and the month they are in
 * stands huge behind it all, written in characters, glitching into the next. They face the way the page moves. Chips
 * jump to a stop. A plain list on narrow screens and for reduced motion.
 */
export default function NpoTimeline({ title, stops }: { title: string; stops: readonly TimelineStop[] }) {
  const section = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const confetti = useRef<HTMLCanvasElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const reachedEnd = useRef(false);
  const [active, setActive] = useState(-1);
  const [month, setMonth] = useState(0);
  const [end, setEnd] = useState(false);

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
      // At the finish: confetti once, again only after walking back away from it.
      const atEnd = m >= 7.98;
      setEnd(atEnd);
      if (atEnd && !reachedEnd.current && confetti.current) {
        const s = confetti.current.getBoundingClientRect(), w = walker.getBoundingClientRect();
        burst(confetti.current, w.left + w.width / 2 - s.left, w.top - s.top);
      }
      reachedEnd.current = atEnd;
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
        <MonthGlyph month={month} />
        <p className="np-tl__monthname" aria-hidden="true">{MONTH_NAMES[month]}</p>
        <div className="ts-wrap np-tl__head">
          <h2 className="ts-h2" id="timeline-title">{title}</h2>
          <ol className="np-tl__chips" aria-label="Jump to a step">
            {stops.map((s, i) => (
              <li key={s.title}>
                <button type="button" onClick={() => go(i)} aria-current={active === i ? "step" : undefined} data-past={active > i || undefined}>
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
              <span className="np-tl__stretch" aria-hidden="true" style={{ ["--at" as string]: build.at, ["--until" as string]: build.until }}>
                <span className="np-tl__stretch-label">A demo every two weeks</span>
              </span>
            )}
            {demoAt.map((m) => (
              <span key={m} className="np-tl__demo" data-at={m} style={{ ["--at" as string]: m }} aria-hidden="true" />
            ))}
            <span className="np-tl__flag" aria-hidden="true" data-reached={end || undefined}>
              <svg viewBox="0 0 24 32"><path d="M3 1v30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path className="np-tl__pennant" d="M4 3h15l-4 5 4 5H4z" fill="currentColor" /></svg>
            </span>
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
                  <p className="np-tl__cardhead">
                    <span>{active > i ? "✓ Done" : `${String(i + 1).padStart(2, "0")} / ${String(stops.length).padStart(2, "0")}`}</span>
                    <span>{s.when}</span>
                  </p>
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
        <canvas ref={confetti} className="np-tl__confetti" aria-hidden="true" />
      </div>
    </section>
  );
}
