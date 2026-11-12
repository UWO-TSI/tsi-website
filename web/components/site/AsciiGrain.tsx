"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { GRAIN_WORDS } from "@/lib/site/config";

// Light symbols; the page's own letters are added to them.
const SYMBOLS = ".:-=+*01";
const CELL_W = 7;
const CELL_H = 12;
// 73 x 42 cells: big enough that the repeat doesn't read as a pattern.
const TILE_W = CELL_W * 73;
const TILE_H = CELL_H * 42;
const DENSITY = 0.42;
const VARIANTS = 3;
const SWAP_FRACTION = 0.06;
const TICK_MS = 160;
// Now and then one of the page's words assembles out of the noise somewhere on screen, holds, and breaks up.
const WORD_GAP_MS = [2500, 6000] as const;
const WORD_HOLD_MS = [1700, 2800] as const;
const WORD_ASSEMBLE_MS = 650;
const WORD_BREAK_MS = 450;
const WORD_TICK_MS = 70;
// The glow that follows a moving pointer: its box, and how long after the pointer stops it fades.
const GLOW_SIZE = 560;
const GLOW_IDLE_MS = 1200;
// Layers that sit above the page grain; a word isn't placed where one of them covers it.
const COVERED = ".hd-stage, .hd-reveal, .gn, .gx-hero, .ts-nav";

const between = ([a, b]: readonly [number, number]) => a + Math.random() * (b - a);

/**
 * A very faint field of characters over the whole page (the texture over contentarchitecture.dev). Around a
 * moving pointer it glows up to the strength of the GENESIS field's background and fades back when the
 * pointer rests. It is a repeating tile laid over the page, so it scrolls with the content instead of
 * sitting still on the screen; three versions of the tile, each with a few percent of cells changed, cycle
 * to make it twinkle. The characters are the page's own letters and a few light symbols, and every few
 * seconds one of the page's words (GRAIN_WORDS) glitches into view and out again at the glow's strength.
 * It inverts against whatever is underneath, so it shows on dark and light grounds alike. The hero's
 * sticky stage sits above it and carries its own copy.
 */
export default function AsciiGrain({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();

  useEffect(() => {
    const el = ref.current!;
    const tile = el.querySelector<HTMLElement>(".ts-grain-tile")!;
    const glow = el.querySelector<HTMLElement>(".ts-grain-glow")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const words = GRAIN_WORDS[path] ?? GRAIN_WORDS["/"];
    const chars = Array.from(new Set(words.join("").replace(/[^A-Z0-9]/g, ""))).join("") + SYMBOLS;
    const pick = () => chars[Math.floor(Math.random() * chars.length)];
    const cols = TILE_W / CELL_W, rows = TILE_H / CELL_H;
    const cells: (string | null)[] = Array.from({ length: cols * rows }, () => (Math.random() < DENSITY ? pick() : null));

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
        if (ch) ctx.fillText(ch, (i % cols) * CELL_W + CELL_W / 2, Math.floor(i / cols) * CELL_H + CELL_H / 2);
      });
      return `url(${c.toDataURL("image/png")})`;
    };
    const variants: string[] = [];
    const build = () => {
      variants.length = 0;
      for (let v = 0; v < (reduce ? 1 : VARIANTS); v++) {
        if (v > 0) {
          const n = Math.floor(cells.length * SWAP_FRACTION);
          for (let k = 0; k < n; k++) cells[Math.floor(Math.random() * cells.length)] = Math.random() < DENSITY ? pick() : null;
        }
        variants.push(render());
      }
      for (const layer of [tile, glow]) {
        layer.style.backgroundImage = variants[0];
        layer.style.backgroundSize = `${TILE_W}px ${TILE_H}px`;
      }
    };

    /**
     * One word, one cell per letter with a blank cell either side, on the tile's grid. Its box is black, so
     * inside the grain's difference blend it clears the noise behind it. Each letter settles out of random
     * characters at its own moment, flickers now and then while it holds, and breaks up at its own moment.
     */
    const live = new Set<{ box: HTMLElement; timer: number }>();
    const show = (word: string, x: number, y: number) => {
      const text = ` ${word} `;
      const box = document.createElement("span");
      box.className = "ts-grain-word";
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      const spans = Array.from(text, () => box.appendChild(document.createElement("span")));
      el.appendChild(box);
      const born = performance.now(), hold = between(WORD_HOLD_MS);
      const settle = spans.map(() => Math.random() * WORD_ASSEMBLE_MS);
      const leave = spans.map(() => WORD_ASSEMBLE_MS + hold + Math.random() * WORD_BREAK_MS);
      const end = WORD_ASSEMBLE_MS + hold + WORD_BREAK_MS + WORD_TICK_MS * 2;
      const entry = { box, timer: 0 };
      const tick = () => {
        const t = performance.now() - born;
        if (t > end) { clearInterval(entry.timer); box.remove(); live.delete(entry); return; }
        spans.forEach((s, i) => {
          const g = t < settle[i] || t > leave[i] ? (Math.random() < 0.6 ? pick() : " ") : Math.random() < 0.012 ? pick() : text[i];
          s.textContent = g;
        });
      };
      tick();
      entry.timer = window.setInterval(tick, WORD_TICK_MS);
      live.add(entry);
    };

    let wordTimer = 0;
    const spawn = () => {
      wordTimer = window.setTimeout(spawn, between(WORD_GAP_MS));
      if (document.visibilityState !== "visible" || live.size > 0) return;
      const r = el.getBoundingClientRect();
      const word = words[Math.floor(Math.random() * words.length)];
      const w = (word.length + 2) * CELL_W;
      const x0 = Math.max(r.left, 16), x1 = Math.min(r.right, window.innerWidth - 16) - w;
      const y0 = Math.max(r.top, 0), y1 = Math.min(r.bottom, window.innerHeight) - CELL_H;
      if (x1 <= x0 || y1 <= y0) return;
      for (let tries = 0; tries < 8; tries++) {
        const x = Math.round((x0 + Math.random() * (x1 - x0) - r.left) / CELL_W) * CELL_W;
        const y = Math.round((y0 + Math.random() * (y1 - y0) - r.top) / CELL_H) * CELL_H;
        const clear = [0, 0.5, 1].every((f) => {
          const hit = document.elementFromPoint(r.left + x + f * w, r.top + y + CELL_H / 2);
          const over = hit?.closest(COVERED);
          return !!hit && (!over || over.contains(el));
        });
        if (clear) { show(word, x, y); return; }
      }
    };

    let timer = 0, i = 0;
    const onVisible = () => {
      clearInterval(timer);
      if (reduce || document.visibilityState !== "visible") return;
      timer = window.setInterval(() => { i = (i + 1) % variants.length; tile.style.backgroundImage = glow.style.backgroundImage = variants[i]; }, TICK_MS);
    };

    // The glow sits under the pointer in the grain's own coordinates, its tile lined up with the field's.
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let px = -1e4, py = -1e4, glowFrame = 0, idle = 0;
    const place = () => {
      glowFrame = 0;
      const r = el.getBoundingClientRect();
      const x = Math.round(px - r.left - GLOW_SIZE / 2), y = Math.round(py - r.top - GLOW_SIZE / 2);
      glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      glow.style.backgroundPosition = `${-x}px ${-y}px`;
    };
    const onPointer = (e: PointerEvent) => {
      px = e.clientX; py = e.clientY;
      if (!glowFrame) glowFrame = requestAnimationFrame(place);
      el.dataset.glow = "on";
      clearTimeout(idle);
      idle = window.setTimeout(() => { el.dataset.glow = "off"; }, GLOW_IDLE_MS);
    };
    const onScroll = () => { if (el.dataset.glow === "on" && !glowFrame) glowFrame = requestAnimationFrame(place); };
    if (fine) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    build();
    document.fonts?.ready.then(build);
    onVisible();
    if (!reduce) wordTimer = window.setTimeout(spawn, between(WORD_GAP_MS));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      clearTimeout(wordTimer);
      clearTimeout(idle);
      cancelAnimationFrame(glowFrame);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      live.forEach((w) => { clearInterval(w.timer); w.box.remove(); });
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [path]);

  return (
    <div ref={ref} className={className ? `ts-ascii-grain ${className}` : "ts-ascii-grain"} aria-hidden="true">
      <div className="ts-grain-tile" />
      <div className="ts-grain-glow" />
    </div>
  );
}
