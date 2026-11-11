"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlobeVisualizer from "@/components/ui/GlobeVisualizer";
import type { DiveRef } from "@/components/ui/GlobeVisualizerWebGPU";
import { NUMBERS } from "@/lib/site/config";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

// The dive, as fractions of the hero's scroll track (100svh + 190svh).
const TAKEOVER = [0, 0.16] as const;
const HOLD = [0.16, 0.4] as const;
const HOLD_SNAP = 0.28;
const DIVE = [0.4, 0.94] as const;
const REVEAL = [0.46, 0.9] as const;

const PAPER = "#f1ffff";
const INK = "#0f0f10";
const GLYPHS = "01<>[]{}/\\|=+*#%&$@!?;:.~ABCDEF0123456789";
const CELL_W = 12;
const CELL_H = 17;

const cellHash = (c: number, r: number) => { const s = Math.sin(c * 127.1 + r * 311.7) * 43758.5453; return s - Math.floor(s); };

/** Smooth noise around the circle, so the edge comes in as clumps. */
function angleNoise() {
  const n = 72;
  const t = Array.from({ length: n }, (_, i) => { const s = Math.sin((i + 1) * 91.17) * 43758.5453; return s - Math.floor(s); });
  return (a: number) => {
    const x = ((a / (Math.PI * 2)) % 1 + 1) % 1 * n;
    const i = Math.floor(x), f = x - i, k = f * f * (3 - 2 * f);
    return t[i % n] + (t[(i + 1) % n] - t[i % n]) * k;
  };
}

/**
 * The hero and the dive (contentarchitecture.dev's MainHeroStage, rebuilt around our globe, with David's
 * changes): the copy leaves and the globe takes the centre (takeover), the page holds there so people can
 * drag the globe, then the globe zooms and rolls while a ragged edge of flickering characters spreads
 * out of its centre, carrying the mission in.
 */
export default function HeroDive() {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const wipe = useRef<HTMLCanvasElement>(null);
  // Read by the globe every frame; a ref, so scrolling never re-renders React.
  const dive = useRef(0) as DiveRef;
  const [base, setBase] = useState(0.72);

  useEffect(() => {
    const fit = () => setBase(window.innerWidth / window.innerHeight < 0.8 ? 0.4 : 0.72);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = stage.current!;
    const canvas = wipe.current!;
    const ctx = canvas.getContext("2d")!;
    const noise = angleNoise();
    let f = 0, dpr = 1, flicker = 0, snapTimer = 0;

    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(el.clientWidth * dpr);
      canvas.height = Math.round(el.clientHeight * dpr);
      draw();
    };

    /** Paints the paper the mission sits on: a clean core, a ragged ring of cells, and characters at the edge. */
    function draw() {
      const w = el.clientWidth, h = el.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (f <= 0) return;
      if (f >= 1) { ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h); return; }
      const cx = w / 2, cy = h / 2;
      // The ragged edge grows with the opening, so the first moment is a small glitch, not a splat.
      const jitter = Math.min(110, 18 + f * 260) * (1 - 0.4 * f);
      const band = CELL_H * 2.2;
      const maxR = Math.hypot(w, h) / 2;
      const R = f * (maxR + jitter * 2 + band) - jitter;
      const core = Math.max(0, R - jitter - band);
      const frame = Math.floor(performance.now() / 85);
      ctx.fillStyle = PAPER;
      if (core > 0) { ctx.beginPath(); ctx.arc(cx, cy, core, 0, Math.PI * 2); ctx.fill(); }
      ctx.font = `500 ${CELL_H * 0.72}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cols = Math.ceil(w / CELL_W), rows = Math.ceil(h / CELL_H);
      for (let r = 0; r < rows; r++) {
        const y = r * CELL_H + CELL_H / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * CELL_W + CELL_W / 2;
          const d = Math.hypot(x - cx, y - cy);
          if (d < core - CELL_H || d > R + jitter + band) continue;
          const k = cellHash(c, r);
          const edge = R + (noise(Math.atan2(y - cy, x - cx)) - 0.5) * 2 * jitter + (k - 0.5) * CELL_H * Math.min(3, 0.6 + f * 6);
          const inside = d < edge;
          if (inside) { ctx.fillStyle = PAPER; ctx.fillRect(c * CELL_W, r * CELL_H, CELL_W + 0.5, CELL_H + 0.5); }
          const gap = Math.abs(d - edge);
          if (gap > band) continue;
          const odds = 1 - gap / band;
          const g = cellHash(c + frame * 0.37, r - frame * 0.11);
          if (g > odds * 0.85) continue;
          ctx.fillStyle = inside ? INK : PAPER;
          ctx.globalAlpha = 0.45 + 0.55 * odds;
          ctx.fillText(GLYPHS[Math.floor(g * 997) % GLYPHS.length], x, y);
          ctx.globalAlpha = 1;
        }
      }
      el.style.setProperty("--core", `${core.toFixed(1)}px`);
    }

    const apply = (p: number) => {
      const t = range(p, TAKEOVER[0], TAKEOVER[1]);
      const hold = p >= HOLD[0] - 0.02 && p <= HOLD[1];
      const d = range(p, DIVE[0], DIVE[1]) ** 1.3;
      f = range(p, REVEAL[0], REVEAL[1]) ** 1.25;
      dive.current = d;
      dive.boost = 1 + 0.3 * t;
      dive.interactive = p < 0.02 || hold;
      el.style.setProperty("--t", t.toFixed(4));
      el.style.setProperty("--hold", hold && t >= 1 ? "1" : "0");
      el.style.setProperty("--arrive", (0.55 + 0.45 * (1 - (1 - f) ** 2)).toFixed(4));
      el.dataset.open = f > 0 ? "true" : "false";
      el.dataset.full = f >= 1 ? "true" : "false";
      el.dataset.taken = t > 0.7 ? "true" : "false";
      if (f <= 0 || f >= 1) el.style.setProperty("--core", f >= 1 ? "200vmax" : "0px");
      draw();
      clearInterval(flicker);
      if (f > 0 && f < 1) flicker = window.setInterval(draw, 85);
    };

    // Stop on the globe: if scrolling rests near the hold, ease back to it.
    const snap = (self: ScrollTrigger) => {
      clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        const p = self.progress;
        if (p > HOLD[0] - 0.06 && p < HOLD[1] + 0.05 && Math.abs(p - HOLD_SNAP) > 0.01) {
          const y = self.start + HOLD_SNAP * (self.end - self.start);
          const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
          if (lenis) lenis.scrollTo(y, { duration: 0.8 });
          else window.scrollTo({ top: y, behavior: "smooth" });
        }
      }, 220);
    };

    const st = ScrollTrigger.create({
      trigger: track.current, start: "top top", end: "bottom bottom",
      onUpdate: (self) => { apply(self.progress); snap(self); },
    });
    window.addEventListener("resize", size);
    size();
    apply(st.progress);
    return () => { st.kill(); clearInterval(flicker); clearTimeout(snapTimer); window.removeEventListener("resize", size); };
  }, [dive]);

  return (
    <section ref={track} className="hd-track" id="hero" aria-label="Tethos">
      <div ref={stage} className="hd-stage" data-tone="dark">
        <div className="hd-globe" aria-hidden="true">
          <GlobeVisualizer className="hd-globe__canvas" dive={dive} base={base} />
        </div>

        <div className="ts-wrap hd-copy">
          <p className="ts-label">Tethos Association</p>
          <h1 className="ts-h1 hd-title">
            <span className="hd-title__dim">Most tech is built to make money.</span>{" "}
            <span>We build it for purpose.</span>
          </h1>
          <p className="ts-lede">Tethos is a student-run nonprofit. We build pro bono technology for nonprofits and the communities they serve.</p>
          <div className="hd-actions">
            <Link href="/npo" className="ts-btn ts-btn--primary">For nonprofits <span className="ts-btn__arrow">→</span></Link>
            <Link href="/genesis" className="ts-btn ts-btn--ghost">For sponsors</Link>
            <Link href="/student/apply" className="ts-btn ts-btn--ghost">For students</Link>
          </div>
        </div>

        <div className="hd-cue" aria-hidden="true">
          <span className="hd-cue__ring" />
          Scroll
        </div>
        <div className="hd-hint" aria-hidden="true">Drag to explore · scroll to dive in</div>

        <canvas ref={wipe} className="hd-wipe" aria-hidden="true" />

        <div className="hd-reveal" data-tone="light" id="about">
          <div className="ts-wrap hd-reveal__inner">
            <p className="ts-label">What we do</p>
            <h2 className="ts-h2 hd-mission">We put student teams on real software for nonprofits, at no cost to them.</h2>
            <p className="ts-body hd-mission__body">
              Tethos runs Tech for Social Impact (TSI), our first branch, with chapters at Western and UBC. Each year its teams build for nonprofits and show the work at GENESIS.
            </p>
            <dl className="hd-numbers">
              {NUMBERS.map((n) => (
                <div key={n.label} className="hd-numbers__item">
                  <dt className="ts-label">{n.label}</dt>
                  <dd className="ts-num hd-numbers__value">{n.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
