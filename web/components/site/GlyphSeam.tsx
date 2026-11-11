"use client";

import { useEffect, useRef } from "react";

const GROUND = { dark: "#0f0f10", deep: "#08090b", light: "#f1ffff" } as const;
type Ground = keyof typeof GROUND;

const GLYPHS = "01<>[]{}()/\\|=+*#%&$@!?;:.~ABCDEF0123456789";
const CELL_W = 12;
const CELL_H = 17;
const HEIGHT = 160;

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
 * The seam between two grounds, drawn as a stepped horizon of characters (contentarchitecture.dev's
 * glyph wipe, rebuilt). The skyline is jagged while the seam rises up the screen and settles as it
 * passes the top third. Characters at the edge flicker 8 times a second, only while on screen.
 */
export default function GlyphSeam({ from, to, seed = 1 }: { from: Ground; to: Ground; seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noise = makeNoise(seed);
    const top = GROUND[from], bottom = GROUND[to];
    let cols = 0, rows = 0, dpr = 1, visible = false, timer = 0, raf = 0;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
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
      const amp = 3.2 * (1 - 0.75 * p);
      const frame = Math.floor(performance.now() / 125);
      const mid = rows / 2;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = top;
      ctx.fillRect(0, 0, canvas.clientWidth, HEIGHT);
      ctx.fillStyle = bottom;
      const edges: number[] = [];
      for (let c = 0; c < cols; c++) {
        const n = noise(c * 0.18) * 0.7 + noise(c * 0.61 + 17) * 0.3;
        const edge = Math.round(mid + (n - 0.5) * 2 * amp);
        edges.push(edge);
        ctx.fillRect(c * CELL_W, edge * CELL_H, CELL_W + 1, HEIGHT);
      }
      ctx.font = `500 ${CELL_H * 0.72}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let c = 0; c < cols; c++) {
        const edge = edges[c];
        for (let d = -2; d <= 1; d++) {
          const row = edge + d;
          if (row < 0 || row >= rows) continue;
          const h = Math.sin((c * 31.7 + row * 11.3 + seed) * 12.9898) * 43758.5453;
          const seedCell = h - Math.floor(h);
          const odds = d === -1 || d === 0 ? 0.55 : 0.22;
          if (seedCell > odds) continue;
          const g = GLYPHS[Math.floor((seedCell * 977 + (reduce ? 0 : frame * (1 + (c % 3)))) % GLYPHS.length)];
          ctx.fillStyle = d < 0 ? bottom : top;
          ctx.globalAlpha = 0.35 + 0.65 * ((seedCell * 7) % 1);
          ctx.fillText(g, c * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2);
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
