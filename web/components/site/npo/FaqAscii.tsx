"use client";

import { useEffect, useRef, useState } from "react";
import { canvasDpr } from "@/lib/site/perf";

type Item = { q: string; a: string };

// The field's cell: every question and answer sits on the same grid as the characters around it.
const CW = 9;
const CH = 16;
const TILE_COLS = 80;
const TILE_ROWS = 40;
const SYMBOLS = ".:-=+*01?";
// The noise: the program's letters and a few light symbols.
const NOISE = "PROBONTFIAGEKWHYDCUL";
const DENSITY = 0.55;
const SETTLE_MS = 650;
const TICK_MS = 45;

const pick = () => (Math.random() < 0.7 ? NOISE[Math.floor(Math.random() * NOISE.length)] : SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);

/** Glitches a text node's content in from noise, leaving spaces where they are. */
export function glitch(node: HTMLElement | null, text: string) {
  if (!node) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = text; return; }
  const settle = Array.from(text, () => Math.random() * SETTLE_MS);
  const t0 = performance.now();
  const tick = () => {
    const t = performance.now() - t0;
    node.textContent = Array.from(text, (c, k) => (c === " " || t >= settle[k] ? c : pick())).join("");
    if (t < SETTLE_MS) setTimeout(tick, TICK_MS);
    else node.textContent = text;
  };
  tick();
}

/**
 * The questions written into a field of characters: the field is a twinkling tile of letters and symbols on a 9 x 16
 * grid, and each question sits in it in white on the same grid. Clicking one glitches its answer in, every letter
 * settling out of noise at its own moment (spaces stay put, so the lines wrap where they will end); clicking again
 * closes it. Every answer is in the page; buttons carry aria-expanded.
 */
export default function FaqAscii({ items }: { items: readonly Item[] }) {
  const field = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<boolean[]>(() => items.map(() => false));

  // The noise tile, three versions cycling; the letter spacing that makes the mono font advance exactly one cell.
  useEffect(() => {
    const el = field.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = canvasDpr();
    const font = `500 14px "Sohne Mono", ui-monospace, monospace`;
    const cells = Array.from({ length: TILE_COLS * TILE_ROWS }, () => (Math.random() < DENSITY ? pick() : ""));
    const alpha = cells.map(() => 0.08 + Math.random() * 0.12);
    const render = () => {
      const c = document.createElement("canvas");
      c.width = TILE_COLS * CW * dpr; c.height = TILE_ROWS * CH * dpr;
      const g = c.getContext("2d")!;
      g.scale(dpr, dpr);
      g.font = `500 13px "Sohne Mono", ui-monospace, monospace`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#f1ffff";
      cells.forEach((ch, i) => { if (ch) { g.globalAlpha = alpha[i]; g.fillText(ch, (i % TILE_COLS) * CW + CW / 2, Math.floor(i / TILE_COLS) * CH + CH / 2 + 1); } });
      return `url(${c.toDataURL("image/png")})`;
    };
    const variants: string[] = [];
    const build = () => {
      const m = document.createElement("canvas").getContext("2d")!;
      m.font = font;
      el.style.setProperty("--ls", `${(CW - m.measureText("0").width).toFixed(3)}px`);
      variants.length = 0;
      for (let v = 0; v < (reduce ? 1 : 3); v++) {
        if (v) for (let k = 0; k < cells.length * 0.05; k++) { const i = Math.floor(Math.random() * cells.length); cells[i] = Math.random() < DENSITY ? pick() : ""; }
        variants.push(render());
      }
      el.style.setProperty("--tile", variants[0]);
      el.style.setProperty("--tile-size", `${TILE_COLS * CW}px ${TILE_ROWS * CH}px`);
    };
    build();
    document.fonts?.ready.then(build, () => {});
    let i = 0;
    const timer = reduce ? 0 : window.setInterval(() => { i = (i + 1) % variants.length; el.style.setProperty("--tile", variants[i]); }, 220);
    // Each block is a whole number of cells wide, so its text and the field's characters share columns.
    const fit = () => {
      const cols = Math.floor((el.clientWidth - 4 * CW) / CW);
      const two = el.clientWidth > 760;
      el.style.setProperty("--w", `${(two ? Math.floor((cols - 6) / 2) : cols) * CW}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => { clearInterval(timer); ro.disconnect(); };
  }, []);

  const toggle = (k: number) => {
    const opening = !open[k];
    setOpen((o) => o.map((v, j) => (j === k ? opening : v)));
    const block = field.current?.querySelectorAll<HTMLElement>(".np-qf__item")[k];
    glitch(block?.querySelector(".np-qf__q") ?? null, items[k].q);
    if (opening) requestAnimationFrame(() => glitch(block?.querySelector(".np-qf__a") ?? null, items[k].a));
  };

  return (
    <div ref={field} className="np-qf">
      <ul className="np-qf__list">
        {items.map((it, k) => (
          <li key={it.q} className="np-qf__item" data-open={open[k] || undefined}>
            <button type="button" className="np-qf__btn" aria-expanded={open[k]} aria-controls={`np-qf-a-${k}`} onClick={() => toggle(k)}>
              <span className="np-qf__mark" aria-hidden="true">{open[k] ? "[-]" : "[+]"}</span>
              <span className="np-qf__q">{it.q}</span>
            </button>
            <p className="np-qf__a" id={`np-qf-a-${k}`} hidden={!open[k]}>{it.a}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
