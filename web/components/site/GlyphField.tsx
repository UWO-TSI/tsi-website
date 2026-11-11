"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** A greyscale image on black; its brightness lifts the characters over a faint field. */
  src: string;
  /** The words the figure is written in. */
  phrase: string;
  /** The words the faint field around the figure is written in (defaults to the phrase). */
  backgroundPhrase?: string;
  className?: string;
  color?: string;
  /** "right": a full-bleed field with the picture on the right, as the reference's features section. */
  layout?: "contain" | "right";
  /**
   * Each pixel of the picture is one character cell, as the reference draws its 160 x 88 model: no
   * scaling or averaging, so the figure keeps its exact shape and may run past the edge. 1200 px and up.
   */
  pixelCells?: boolean;
};

const SCRAMBLE = "GENESIS0123456789+*#@%&";
// The one faint layer around the figure (David: one layer, saying GENESIS, low opacity).
const BACKGROUND_ALPHA = 0.045;
// Scaled pictures have their mid-tones lifted so the figure stands clear of the field.
const GAIN = 1.35;
const FLIP_HZ = 0.18;
const FLIP_THRESHOLD = 0.97;
const FLIP_SWAPS = 2.5;
const ENTRANCE_S = 1.8;
const ENTRANCE_FADE_S = 0.5;
// A click is a stone dropped in a pond: three slow grey rings that widen and fade.
const RIPPLE_S = 4.2;
const RINGS = 3;
const RING_GAP_S = 0.34;
const RIPPLE_GREY = 0.3;
// The pointer's dim is a soft Gaussian falloff, not a hard-edged hole.
const HOVER_SIGMA = 5.5;
const FPS = 24;
const FPS_ACTIVE = 60;

const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const hash1 = (x: number) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };

/**
 * A picture written in characters (contentarchitecture.dev's glyph field, rebuilt on Canvas 2D). It fills
 * its box and scrolls with the page; the figure sits still in it. Every figure cell shows the next letter
 * of the phrase, each row from its own offset, at brightness ^ 0.55; the cells around it are one faint
 * layer of the background phrase. A few figure cells twinkle, the pointer dims a soft patch, a click
 * sends slow grey pond rings, and the figure arrives along a ring from its centre the first time it's
 * seen. Draws only while on screen.
 */
export default function GlyphField({ src, phrase, backgroundPhrase, className = "", color = "#f1ffff", layout = "contain", pixelCells = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bgPhrase = backgroundPhrase ?? phrase;
    let raf = 0, last = 0, visible = false, started = 0, entranceStart = Infinity;
    let cols = 0, rows = 0, cw = 7, ch = 12, dpr = 1;
    let img: { w: number; h: number; data: Uint8ClampedArray } | null = null;
    let region = { x: 0, y: 0, w: 0, h: 0 };
    let atlas: HTMLCanvasElement | null = null;
    let glyphs = "";
    let figureIndex: number[] = [], backgroundIndex: number[] = [];
    let rowOffset: number[] = [];
    let cellB = new Float32Array(0);
    const mouse = { x: -1e4, y: -1e4, sx: -1e4, sy: -1e4, influence: 0, target: 0, moved: 0 };
    const ripples: { x: number; y: number; t: number }[] = [];

    /** One row of glyphs at full strength; each cell is drawn with its own alpha. */
    const buildAtlas = () => {
      glyphs = Array.from(new Set((phrase + bgPhrase + SCRAMBLE).split(""))).join("");
      figureIndex = Array.from(phrase, (g) => glyphs.indexOf(g));
      backgroundIndex = Array.from(bgPhrase, (g) => glyphs.indexOf(g));
      const sw = Math.ceil(cw * dpr), sh = Math.ceil(ch * dpr);
      const a = document.createElement("canvas");
      a.width = sw * glyphs.length;
      a.height = sh;
      const g = a.getContext("2d")!;
      g.font = `500 ${Math.round((ch - 2) * dpr)}px "Sohne Mono", ui-monospace, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = color;
      for (let i = 0; i < glyphs.length; i++) g.fillText(glyphs[i], i * sw + sw / 2, sh / 2);
      atlas = a;
    };

    const sample = (x: number, y: number) => {
      if (!img) return 0;
      const u = (x - region.x) / region.w, v = (y - region.y) / region.h;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) return 0;
      return img.data[(Math.floor(v * img.h) * img.w + Math.floor(u * img.w)) * 4] / 255;
    };

    const relayout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      // The page grain's cell (AsciiGrain), so every ASCII surface on the site is one size.
      ch = w < 520 ? 10 : 12;
      cw = w < 520 ? 6 : 7;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cols = Math.floor(w / cw);
      rows = Math.floor(h / ch);
      rowOffset = Array.from({ length: rows }, (_, r) => Math.floor(hash1(r + 0.5) * 997));
      cellB = new Float32Array(cols * rows);
      if (img && pixelCells && w >= 1200) {
        // Right of the middle, far enough left that the whole sphere (the first ~110 columns) stays on
        // screen while the hand runs off the right edge; a few rows down from the top of the box.
        const x0 = Math.round(Math.min(w * 0.46, w - 800) / cw), y0 = Math.max(0, Math.min(6, rows - img.h));
        region = { x: x0 * cw, y: y0 * ch, w: img.w * cw, h: img.h * ch };
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const u = c - x0, v = r - y0;
          if (u >= 0 && u < img.w && v >= 0 && v < img.h) cellB[r * cols + c] = img.data[(v * img.w + u) * 4] / 255;
        }
      } else if (img) {
        const aspect = img.w / img.h;
        const maxW = layout === "right" && w > 820 ? w * 0.52 : w;
        const fitH = Math.min(h, window.innerHeight) * 0.96;
        let rh = fitH, rw = rh * aspect;
        if (rw > maxW) { rw = maxW; rh = rw / aspect; }
        const x = layout === "right" && w > 820 ? w - rw - w * 0.025 : (w - rw) / 2;
        region = { x, y: Math.max(0, Math.min((h - rh) / 2, 72)), w: rw, h: rh };
        // Each cell takes the average of the picture under it (4 x 4 samples), so the figure keeps its shape.
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          let sum = 0;
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) sum += sample(c * cw + (i + 0.5) * cw / 4, r * ch + (j + 0.5) * ch / 4);
          cellB[r * cols + c] = Math.min(1, (sum / 16) * GAIN);
        }
      }
      buildAtlas();
    };

    const draw = (now: number) => {
      raf = 0;
      if (!atlas || !cols) return;
      const time = (now - started) / 1000;
      mouse.influence += (mouse.target - mouse.influence) * 0.12;
      if (mouse.sx < -1e3) { mouse.sx = mouse.x; mouse.sy = mouse.y; }
      mouse.sx += (mouse.x - mouse.sx) * 0.22;
      mouse.sy += (mouse.y - mouse.sy) * 0.22;
      const sw = Math.ceil(cw * dpr), sh = Math.ceil(ch * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sigma2 = 2 * (HOVER_SIGMA * ch) ** 2;
      const maxR = Math.min(Math.hypot(canvas.clientWidth, canvas.clientHeight) * 0.6, 1400);
      const flipFrame = Math.floor(time * FLIP_SWAPS);
      const cx = region.x + region.w / 2, cy = region.y + region.h * 0.3;
      // Only the rows on screen (and a little either side) are drawn.
      const top = canvas.getBoundingClientRect().top;
      const r0 = Math.max(0, Math.floor(-top / ch) - 4), r1 = Math.min(rows, Math.ceil((window.innerHeight - top) / ch) + 4);
      for (let r = r0; r < r1; r++) {
        const y = r * ch + ch / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * cw + cw / 2;
          const b = cellB[r * cols + c];
          const inModel = b > 0.03;
          let opacity = inModel ? Math.pow(b, 0.55) : BACKGROUND_ALPHA;
          const threshold = hash(c, r + rows * 3.1);

          let entrance = 1;
          if (entranceStart < Infinity) {
            const arrival = (Math.hypot(x - cx, y - cy) / maxR) * ENTRANCE_S;
            entrance = Math.min(1, Math.max(0, (time - entranceStart - arrival) / ENTRANCE_FADE_S));
            if (entrance <= 0) continue;
          }

          // Pond rings: each lifts the cells it passes to a soft grey and nudges them outward a little.
          let ripple = 0, ox = 0, oy = 0;
          for (const rp of ripples) {
            const e = time - rp.t;
            if (e < 0 || e >= RIPPLE_S) continue;
            const dx = x - rp.x, dy = y - rp.y, d = Math.hypot(dx, dy) || 1;
            for (let j = 0; j < RINGS; j++) {
              const ej = e - j * RING_GAP_S;
              if (ej <= 0) continue;
              const R = maxR * (1 - Math.exp(-ej * 0.8));
              const w = ch * (1.3 + ej * 1.1);
              const amp = Math.pow(Math.max(0, 1 - ej / RIPPLE_S), 1.6) * Math.pow(0.6, j);
              const v = Math.exp(-((d - R) ** 2) / (2 * w * w)) * amp;
              if (v > ripple) { ripple = v; ox = (dx / d) * v * 2; oy = (dy / d) * v * 2; }
            }
          }

          const hover = Math.exp(-((x - mouse.sx) ** 2 + (y - mouse.sy) ** 2) / sigma2) * mouse.influence;
          opacity *= 1 - 0.92 * hover;
          if (inModel && threshold < hover * hover * 0.5) opacity = 0;
          opacity = Math.max(opacity, RIPPLE_GREY * ripple);
          opacity *= entrance;
          if (opacity < 0.012) continue;

          let gi: number;
          if (inModel) {
            gi = figureIndex[(c + rowOffset[r]) % figureIndex.length];
            const flip = !reduce && Math.sin(time * FLIP_HZ * Math.PI * 2 + threshold * 6.283) * 0.5 + 0.5 > FLIP_THRESHOLD;
            if (flip) gi = Math.floor(hash1(threshold * 17.13 + flipFrame * 1.7) * glyphs.length);
          } else {
            gi = backgroundIndex[(c + rowOffset[r]) % backgroundIndex.length];
          }
          ctx.globalAlpha = Math.min(1, opacity);
          ctx.drawImage(atlas, gi * sw, 0, sw, sh, Math.round((c * cw + ox) * dpr), Math.round((r * ch + oy) * dpr), sw, sh);
        }
      }
      ctx.globalAlpha = 1;
      for (let i = ripples.length - 1; i >= 0; i--) if (time - ripples[i].t > RIPPLE_S) ripples.splice(i, 1);
    };

    const loop = (now: number) => {
      if (!visible) return;
      // Full frame rate while something moves (a ripple, the pointer, the page), 24 fps at rest.
      const active = ripples.length > 0 || now - mouse.moved < 600 || Math.abs(mouse.target - mouse.influence) > 0.01;
      if (now - last >= 1000 / (active ? FPS_ACTIVE : FPS) - 1) { last = now; draw(now); }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

    const image = new Image();
    image.onload = () => {
      const off = document.createElement("canvas");
      off.width = image.naturalWidth; off.height = image.naturalHeight;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(image, 0, 0);
      img = { w: off.width, h: off.height, data: g.getImageData(0, 0, off.width, off.height).data };
      relayout();
      if (reduce) draw(performance.now()); else start();
    };
    image.src = src;
    started = performance.now();

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && entranceStart === Infinity && !reduce) entranceStart = (performance.now() - started) / 1000;
      if (reduce) { if (visible) draw(performance.now()); return; }
      start();
    }, { threshold: 0.05 });
    io.observe(canvas);

    // The box can change height after load (fonts, reveals); lay out again when it does.
    const ro = new ResizeObserver(() => { relayout(); draw(performance.now()); });
    ro.observe(canvas);
    // Rows come on screen as the page scrolls; draw them straight away rather than at the next tick.
    const onScroll = () => { if (visible && reduce) draw(performance.now()); else mouse.moved = Math.max(mouse.moved, performance.now() - 300); };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.target = 1; mouse.moved = performance.now();
    };
    const onLeave = () => { mouse.target = 0; };
    const onClick = (e: PointerEvent) => {
      if (reduce) return;
      const r = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: (performance.now() - started) / 1000 });
      if (ripples.length > 8) ripples.shift();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.fonts?.ready.then(() => { if (img) { relayout(); draw(performance.now()); } });

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, [src, phrase, backgroundPhrase, color, layout, pixelCells]);

  return <canvas ref={ref} className={className} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden="true" />;
}
