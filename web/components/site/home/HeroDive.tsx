"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import GlobeVisualizer from "@/components/ui/GlobeVisualizer";
import AsciiGrain from "@/components/site/AsciiGrain";
import type { DiveRef } from "@/components/ui/GlobeVisualizerWebGPU";
import { canvasDpr } from "@/lib/site/perf";
import { PLAY_ORIGIN } from "@/lib/hosts";

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
// The same cell as the page grain (AsciiGrain).
const CELL_W = 7;
const CELL_H = 12;

const cellHash = (c: number, r: number) => { const s = Math.sin(c * 127.1 + r * 311.7) * 43758.5453; return s - Math.floor(s); };

/**
 * The hero and the dive (contentarchitecture.dev's MainHeroStage, rebuilt around our globe, with David's
 * changes): the copy leaves and the globe takes the centre (takeover), the page holds there so people can
 * drag the globe, then the globe zooms and rolls while a circle of paper with a glitched edge of cells
 * and flickering characters spreads out of its centre, carrying the mission in.
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
    const reveal = el.querySelector<HTMLElement>(".hd-reveal")!;
    const ctx = canvas.getContext("2d")!;
    let f = 0, dpr = 1, flicker = 0, snapTimer = 0;

    const size = () => {
      dpr = canvasDpr();
      canvas.width = Math.round(el.clientWidth * dpr);
      canvas.height = Math.round(el.clientHeight * dpr);
      draw();
    };

    /**
     * Paints the paper the mission sits on: a circle built row by row out of cells, each row's ends pushed
     * a few cells in or out (some rows torn further, and they flicker), stray cells and characters around
     * it. The mission is clipped to the same rows, so its edge is the glitch, not a clean arc.
     */
    function draw() {
      const w = el.clientWidth, h = el.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (f <= 0) return;
      if (f >= 1) { ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h); reveal.style.clipPath = ""; return; }
      const cx = w / 2, cy = h / 2;
      const cols = Math.ceil(w / CELL_W), rows = Math.ceil(h / CELL_H);
      // How far a row's end can wander, in cells: small at first so the opening is a glitch, not a splat.
      const reach = Math.min(7, 1.5 + f * 15);
      const band = CELL_W * (reach + 5);
      const R = f * (Math.hypot(w, h) / 2 + band);
      const slow = Math.floor(performance.now() / 170);
      const fast = Math.floor(performance.now() / 85);
      const left: number[] = [], right: number[] = [];
      ctx.fillStyle = PAPER;
      for (let r = 0; r < rows; r++) {
        const dy = Math.abs(r * CELL_H + CELL_H / 2 - cy);
        left[r] = right[r] = -1;
        if (dy >= R) continue;
        const half = Math.sqrt(R * R - dy * dy);
        let l = Math.round((cx - half) / CELL_W + (cellHash(r, slow) - 0.5) * 2 * reach);
        let rr = Math.round((cx + half) / CELL_W + (cellHash(r + 0.5, slow + 0.5) - 0.5) * 2 * reach);
        // A few rows tear sideways for a frame.
        const tear = cellHash(r * 3.1, fast);
        if (tear > 0.9) { const s = Math.round((tear - 0.95) * 80 * reach / 4); l += s; rr += s; }
        l = Math.max(0, l); rr = Math.min(cols, rr);
        if (rr - l < 1) { const m = Math.round(cx / CELL_W); l = m - 1; rr = m + 1; }
        left[r] = l; right[r] = rr;
        ctx.fillRect(l * CELL_W, r * CELL_H, (rr - l) * CELL_W + 0.5, CELL_H + 0.5);
      }

      ctx.font = `500 ${CELL_H - 2}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let r = 0; r < rows; r++) {
        const y = r * CELL_H + CELL_H / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * CELL_W + CELL_W / 2;
          const d = Math.hypot(x - cx, y - cy);
          const gap = Math.abs(d - R);
          if (gap > band) continue;
          const inside = left[r] >= 0 && c >= left[r] && c < right[r];
          const odds = 1 - gap / band;
          const g = cellHash(c + fast * 0.37, r - fast * 0.11);
          if (g > odds * 0.8) continue;
          const glyph = GLYPHS[Math.floor(g * 997) % GLYPHS.length];
          // Mostly characters; some cells flip to a solid block with the character knocked out of it.
          const block = cellHash(c * 1.7, r + slow) > 0.82;
          if (block) {
            ctx.fillStyle = inside ? INK : PAPER;
            ctx.fillRect(c * CELL_W, r * CELL_H, CELL_W + 0.5, CELL_H + 0.5);
            ctx.fillStyle = inside ? PAPER : INK;
          } else {
            ctx.fillStyle = inside ? INK : PAPER;
            ctx.globalAlpha = 0.45 + 0.55 * odds;
          }
          ctx.fillText(glyph, x, y);
          ctx.globalAlpha = 1;
        }
      }

      // The mission's clip: down the right ends of the rows, back up the left ends.
      const pts: string[] = [];
      for (let r = 0; r < rows; r++) if (left[r] >= 0) pts.push(`${right[r] * CELL_W}px ${r * CELL_H}px`, `${right[r] * CELL_W}px ${(r + 1) * CELL_H}px`);
      for (let r = rows - 1; r >= 0; r--) if (left[r] >= 0) pts.push(`${left[r] * CELL_W}px ${(r + 1) * CELL_H}px`, `${left[r] * CELL_W}px ${r * CELL_H}px`);
      reveal.style.clipPath = pts.length ? `polygon(${pts.join(",")})` : "inset(50%)";
    }

    const apply = (p: number) => {
      const t = range(p, TAKEOVER[0], TAKEOVER[1]);
      const hold = p >= HOLD[0] - 0.02 && p <= HOLD[1];
      const d = range(p, DIVE[0], DIVE[1]) ** 1.3;
      f = range(p, REVEAL[0], REVEAL[1]) ** 1.25;
      dive.current = d;
      dive.boost = 1 + 0.3 * t;
      dive.interactive = p < 0.02 || hold;
      // Under the full paper (and past the hero) nothing of the globe shows, so it stops drawing.
      const hidden = f >= 1;
      if (dive.hidden && !hidden) window.dispatchEvent(new Event("globe-wake"));
      dive.hidden = hidden;
      el.style.setProperty("--t", t.toFixed(4));
      el.style.setProperty("--hold", hold && t >= 1 ? "1" : "0");
      el.style.setProperty("--arrive", (0.55 + 0.45 * (1 - (1 - f) ** 2)).toFixed(4));
      el.dataset.open = f > 0 ? "true" : "false";
      el.dataset.full = f >= 1 ? "true" : "false";
      el.dataset.taken = t > 0.7 ? "true" : "false";
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
        <AsciiGrain className="hd-grain" />
        <div className="hd-globe" aria-hidden="true">
          <GlobeVisualizer className="hd-globe__canvas" dive={dive} base={base} />
        </div>

        <div className="ts-wrap hd-copy">
          <h1 className="ts-h1 hd-title">
            <span className="hd-title__dim">Most tech is built to make money.</span>{" "}
            <span>We build it for purpose.</span>
          </h1>
          <p className="ts-lede">Tethos is a student-run nonprofit. We build pro bono technology for nonprofits and the communities they serve.</p>
          <div className="hd-actions">
            <Link href="/npo" className="ts-btn ts-btn--primary">For nonprofits <span className="ts-btn__arrow">→</span></Link>
            <Link href="/genesis" className="ts-btn ts-btn--ghost">For sponsors</Link>
            {/* Members go straight into the game portal (David, 2026-11-12); new students find /students in the nav. */}
            <a href={`${PLAY_ORIGIN}/`} className="ts-btn ts-btn--ghost">Student sign in <span className="ts-btn__arrow" aria-hidden="true">↗</span></a>
          </div>
        </div>

        <div className="hd-cue" aria-hidden="true">
          <span className="hd-cue__arrow"><i>v</i></span>
          Scroll
        </div>
        <div className="hd-hint" aria-hidden="true">Drag to explore · scroll to dive in</div>

        <canvas ref={wipe} className="hd-wipe" aria-hidden="true" />

        <div className="hd-reveal" data-tone="light" id="about">
          <div className="ts-wrap hd-reveal__inner">
            <h2 className="ts-h2 hd-mission">We put student teams on real software for nonprofits, at no cost to them.</h2>
            <p className="ts-body hd-mission__body">
              Tethos runs Tech for Social Impact (TSI), our first branch, with chapters at Western and UBC. Each year its teams build for nonprofits and show the work at GENESIS.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
