"use client";

import { useEffect, useRef } from "react";

const CHARS = ".:-=+*#%@01";
const CELL_W = 7;
const CELL_H = 12;
const DENSITY = 0.42;
const SWAP_FRACTION = 0.035;
const TICK_MS = 110;

/**
 * A faint field of characters over the whole site, light enough to read as grain (the texture over
 * contentarchitecture.dev). Drawn once at device-pixel 1, then a few percent of cells change each
 * tick; it inverts against whatever is underneath, so it shows on dark and light grounds alike.
 */
export default function AsciiGrain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0, rows = 0, timer = 0;

    const cell = (c: number, r: number) => {
      ctx.clearRect(c * CELL_W, r * CELL_H, CELL_W, CELL_H);
      if (Math.random() > DENSITY) return;
      ctx.globalAlpha = 0.35 + Math.random() * 0.65;
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], c * CELL_W + CELL_W / 2, r * CELL_H + CELL_H / 2);
    };
    const fill = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      cols = Math.ceil(canvas.width / CELL_W);
      rows = Math.ceil(canvas.height / CELL_H);
      ctx.font = `500 ${CELL_H - 2}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cell(c, r);
    };
    const swap = () => {
      const n = Math.floor(cols * rows * SWAP_FRACTION);
      for (let i = 0; i < n; i++) cell(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows));
    };

    fill();
    document.fonts?.ready.then(fill);
    let resizeTimer = 0;
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(fill, 150); };
    window.addEventListener("resize", onResize);
    const onVisible = () => {
      clearInterval(timer);
      if (!reduce && document.visibilityState === "visible") timer = window.setInterval(swap, TICK_MS);
    };
    onVisible();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <canvas ref={ref} className="ts-ascii-grain" aria-hidden="true" />;
}
