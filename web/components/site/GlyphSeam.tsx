"use client";

import { useEffect, useRef } from "react";
import { canvasDpr } from "@/lib/site/perf";

const GROUND = { dark: "#0f0f10", deep: "#08090b", light: "#f1ffff" } as const;
type Ground = keyof typeof GROUND;

const GLYPHS = "01<>[]{}()/\\|=+*#%&$@!?;:.~ABCDEF0123456789";
// The same cell as the page grain (AsciiGrain), so the characters match the texture behind them.
const CELL_W = 7;
const CELL_H = 12;
// The canvas's height (CSS sets 192 px, or 128 px on phones); read from the element so both stay in step.
let HEIGHT = 192;
// The seam steps through this many tones from one ground to the other, each step its own jagged edge.
const STEPS = 5;

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
};

/** Smooth 1D value noise from a fixed random table, so each seam keeps its own skyline. */
function makeNoise(seed: number) {
  const table = Array.from({ length: 64 }, (_, i) => {
    const s = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    return s - Math.floor(s);
  });
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number) => {
    const i = Math.floor(x), f = smooth(x - i);
    const a = table[((i % 64) + 64) % 64], b = table[(((i + 1) % 64) + 64) % 64];
    return a + (b - a) * f;
  };
}

/**
 * The seam between two grounds, drawn as stepped horizons of characters (contentarchitecture.dev's
 * glyph wipe, rebuilt): the ground changes in five tones (black, dark grey, grey, light grey, white),
 * each with its own jagged edge. The edges are jagged while the seam rises up the screen and settle as
 * it passes the top third. Characters at the edges flicker 8 times a second, only while on screen.
 */
export default function GlyphSeam({ from, to, seed = 1 }: { from: Ground; to: Ground; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noises = Array.from({ length: STEPS - 1 }, (_, i) => [makeNoise(seed + i * 7.31), makeNoise(seed * 3.7 + i * 2.9)]);
    const tones = Array.from({ length: STEPS }, (_, i) => mix(GROUND[from], GROUND[to], i / (STEPS - 1)));
    let cols = 0, rows = 0, dpr = 1, visible = false, timer = 0, raf = 0;

    const resize = () => {
      dpr = canvasDpr();
      const w = canvas.clientWidth;
      HEIGHT = canvas.clientHeight || 192;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      cols = Math.ceil(w / CELL_W);
      rows = Math.ceil(HEIGHT / CELL_H);
      draw();
    };

    const progress = () => {
      const r = canvas.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const vh = window.innerHeight;
      return Math.min(1, Math.max(0, (vh - mid) / (vh * 0.65)));
    };

    const draw = () => {
      raf = 0;
      if (!cols) return;
      const p = reduce ? 1 : progress();
      const amp = 2.4 * (1 - 0.6 * p);
      const frame = Math.floor(performance.now() / 125);
      // The edges sit evenly through the middle of the seam, about three rows apart.
      const gap = 3, first = Math.round(rows / 2 - (gap * (STEPS - 2)) / 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = tones[0];
      ctx.fillRect(0, 0, canvas.clientWidth, HEIGHT);
      const edges: number[][] = [];
      for (let k = 0; k < STEPS - 1; k++) {
        const [n1, n2] = noises[k];
        const row: number[] = [];
        ctx.fillStyle = tones[k + 1];
        for (let c = 0; c < cols; c++) {
          const n = n1(c * 0.1) * 0.7 + n2(c * 0.36 + 17) * 0.3;
          let edge = Math.round(first + k * gap + (n - 0.5) * 2 * amp);
          if (k > 0) edge = Math.max(edge, edges[k - 1][c]);
          row.push(edge);
          ctx.fillRect(c * CELL_W, edge * CELL_H, CELL_W + 1, HEIGHT);
        }
        edges.push(row);
      }
      ctx.font = `500 ${CELL_H - 2}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let k = 0; k < STEPS - 1; k++) {
        for (let c = 0; c < cols; c++) {
          const edge = edges[k][c];
          for (let d = -2; d <= 1; d++) {
            const row = edge + d;
            if (row < 0 || row >= rows) continue;
            const h = Math.sin((c * 31.7 + row * 11.3 + seed + k * 5.1) * 12.9898) * 43758.5453;
            const seedCell = h - Math.floor(h);
            const odds = d === -1 || d === 0 ? 0.45 : 0.16;
            if (seedCell > odds) continue;
            const g = GLYPHS[Math.floor((seedCell * 977 + (reduce ? 0 : frame * (1 + (c % 3)))) % GLYPHS.length)];
            // Characters above an edge take the next tone down, those below it the tone above.
            ctx.fillStyle = d < 0 ? tones[Math.min(STEPS - 1, k + 1)] : tones[k];
            ctx.globalAlpha = 0.45 + 0.55 * ((seedCell * 7) % 1);
            ctx.fillText(g, c * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = () => { if (!raf) raf = requestAnimationFrame(draw); };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      clearInterval(timer);
      if (visible && !reduce) timer = window.setInterval(tick, 125);
      tick();
    });
    io.observe(canvas);
    const onScroll = () => { if (visible) tick(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    resize();
    document.fonts?.ready.then(tick);
    return () => {
      io.disconnect();
      clearInterval(timer);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
    };
  }, [from, to, seed]);

  return (
    <div className="ts-seam" aria-hidden="true">
      <canvas ref={ref} />
    </div>
  );
}
