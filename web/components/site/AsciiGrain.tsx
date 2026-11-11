"use client";

import { useEffect, useRef } from "react";

const CHARS = ".:-=+*#%@01";
const CELL_W = 7;
const CELL_H = 12;
// 73 x 42 cells: big enough that the repeat doesn't read as a pattern.
const TILE_W = CELL_W * 73;
const TILE_H = CELL_H * 42;
const DENSITY = 0.42;
const VARIANTS = 3;
const SWAP_FRACTION = 0.06;
const TICK_MS = 160;

/**
 * A faint field of characters over the whole page, light enough to read as grain (the texture over
 * contentarchitecture.dev). It is a repeating tile laid over the page, so it scrolls with the content
 * instead of sitting still on the screen; three versions of the tile, each with a few percent of cells
 * changed, cycle to make it twinkle. It inverts against whatever is underneath, so it shows on dark and
 * light grounds alike. The hero's sticky stage sits above it and carries its own copy behind the globe.
 */
export default function AsciiGrain({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = TILE_W / CELL_W, rows = TILE_H / CELL_H;
    const cells: (string | null)[] = Array.from({ length: cols * rows }, () => (Math.random() < DENSITY ? CHARS[Math.floor(Math.random() * CHARS.length)] : null));
    const alpha = cells.map(() => 0.35 + Math.random() * 0.65);

    const render = () => {
      const c = document.createElement("canvas");
      c.width = TILE_W * dpr;
      c.height = TILE_H * dpr;
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.font = `500 ${CELL_H - 2}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      cells.forEach((ch, i) => {
        if (!ch) return;
        ctx.globalAlpha = alpha[i];
        ctx.fillText(ch, (i % cols) * CELL_W + CELL_W / 2, Math.floor(i / cols) * CELL_H + CELL_H / 2);
      });
      return `url(${c.toDataURL("image/png")})`;
    };
    const variants: string[] = [];
    const build = () => {
      variants.length = 0;
      for (let v = 0; v < (reduce ? 1 : VARIANTS); v++) {
        if (v > 0) {
          const n = Math.floor(cells.length * SWAP_FRACTION);
          for (let k = 0; k < n; k++) {
            const i = Math.floor(Math.random() * cells.length);
            cells[i] = Math.random() < DENSITY ? CHARS[Math.floor(Math.random() * CHARS.length)] : null;
          }
        }
        variants.push(render());
      }
      el.style.backgroundImage = variants[0];
      el.style.backgroundSize = `${TILE_W}px ${TILE_H}px`;
    };

    let timer = 0, i = 0;
    const onVisible = () => {
      clearInterval(timer);
      if (reduce || document.visibilityState !== "visible") return;
      timer = window.setInterval(() => { i = (i + 1) % variants.length; el.style.backgroundImage = variants[i]; }, TICK_MS);
    };
    build();
    document.fonts?.ready.then(build);
    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  return <div ref={ref} className={className ? `ts-ascii-grain ${className}` : "ts-ascii-grain"} aria-hidden="true" />;
}
