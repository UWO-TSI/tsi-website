"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** A greyscale image on black; its brightness lifts the characters over a faint field. */
  src: string;
  /** The words the field is written in. */
  phrase: string;
  className?: string;
  color?: string;
  /** Optional colour for the brightest cells; the reference keeps everything one colour. */
  accent?: string;
  /** "right": a full-bleed field with the picture on the right (up to 55% of the width), as the reference's features section. */
  layout?: "contain" | "right";
};

const SCRAMBLE = "GENESIS0123456789+*#@%&";
const LEVELS = 16;
const BACKGROUND = 0.03;
const FLIP_HZ = 0.18;
const FLIP_THRESHOLD = 0.97;
const FLIP_SWAPS = 2.5;
const RIPPLE_S = 1.8;
const ENTRANCE_FADE_S = 0.5;
const FPS = 24;

const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const hash1 = (x: number) => { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * A picture written in characters (contentarchitecture.dev's glyph field, rebuilt on Canvas 2D).
 * Every cell shows the next letter of the phrase, each row from its own offset; the image only
 * raises a cell's opacity (brightness ^ 0.6) over a faint background. About 8% of image cells
 * twinkle, the pointer dims a stippled patch, clicks send a ring of scrambled characters, and the
 * figure arrives along a ring from its centre the first time it's seen. Draws only on screen.
 */
export default function GlyphField({ src, phrase, className = "", color = "#f1ffff", accent, layout = "contain" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, last = 0, visible = false, started = 0, entranceStart = Infinity;
    let cols = 0, rows = 0, cw = 8, ch = 13, dpr = 1;
    let img: { w: number; h: number; data: Uint8ClampedArray } | null = null;
    let region = { x: 0, y: 0, w: 0, h: 0 };
    let atlas: HTMLCanvasElement | null = null;
    let glyphs = "";
    let rowOffset: number[] = [];
    let cellB = new Float32Array(0);
    const mouse = { x: -1e4, y: -1e4, influence: 0, target: 0 };
    const ripples: { x: number; y: number; t: number }[] = [];

    const buildAtlas = () => {
      glyphs = Array.from(new Set((phrase + SCRAMBLE).split(""))).join("");
      const a = document.createElement("canvas");
      a.width = Math.ceil(cw * dpr) * glyphs.length;
      a.height = Math.ceil(ch * dpr) * (LEVELS + 1);
      const g = a.getContext("2d")!;
      g.font = `500 ${Math.round((ch - 2) * dpr)}px "Sohne Mono", ui-monospace, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const sw = Math.ceil(cw * dpr), sh = Math.ceil(ch * dpr);
      for (let l = 0; l <= LEVELS; l++) {
        g.fillStyle = l === LEVELS ? accent ?? color : color;
        g.globalAlpha = l === LEVELS ? 1 : (l + 1) / LEVELS;
        for (let i = 0; i < glyphs.length; i++) g.fillText(glyphs[i], i * sw + sw / 2, l * sh + sh / 2);
      }
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
      // The page grain's cell (AsciiGrain), so every ASCII surface on the site is one size.
      ch = w < 520 ? 10 : 12;
      cw = w < 520 ? 6 : 7;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cols = Math.floor(w / cw);
      rows = Math.floor(h / ch);
      rowOffset = Array.from({ length: rows }, (_, r) => Math.floor(hash1(r + 0.5) * phrase.length));
      if (img) {
        const aspect = img.w / img.h;
        const maxW = layout === "right" && w > 820 ? w * 0.55 : w;
        let rh = h * 0.96, rw = rh * aspect;
        if (rw > maxW) { rw = maxW; rh = rw / aspect; }
        const x = layout === "right" && w > 820 ? w - rw - w * 0.06 : (w - rw) / 2;
        region = { x, y: (h - rh) / 2, w: rw, h: rh };
      }
      // Each cell takes the average of the picture under it (4 x 4 samples), not one pixel, so the
      // figure keeps its shape at any size.
      cellB = new Float32Array(cols * rows);
      if (img) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          let sum = 0;
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) sum += sample(c * cw + (i + 0.5) * cw / 4, r * ch + (j + 0.5) * ch / 4);
          cellB[r * cols + c] = sum / 16;
        }
      }
      buildAtlas();
    };

    const draw = (now: number) => {
      raf = 0;
      if (!atlas || !cols) return;
      const time = (now - started) / 1000;
      mouse.influence += (mouse.target - mouse.influence) * 0.15;
      const sw = Math.ceil(cw * dpr), sh = Math.ceil(ch * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const radius = 7 * ch;
      const maxR = Math.hypot(canvas.clientWidth, canvas.clientHeight) * 0.6;
      const flipFrame = Math.floor(time * FLIP_SWAPS);
      const scrambleFrame = Math.floor(time * 24);
      const cx = region.x + region.w / 2, cy = region.y + region.h * 0.3;
      for (let r = 0; r < rows; r++) {
        const y = r * ch + ch / 2;
        for (let c = 0; c < cols; c++) {
          const x = c * cw + cw / 2;
          const b = cellB[r * cols + c] ?? 0;
          const inModel = b > 0.03;
          const level = Math.max(BACKGROUND, b);
          let opacity = Math.pow(level, 0.6);
          const threshold = hash(c, r + rows * 3.1);

          let entrance = 1;
          if (entranceStart < Infinity) {
            const arrival = (Math.hypot(x - cx, y - cy) / maxR) * RIPPLE_S;
            entrance = Math.min(1, Math.max(0, (time - entranceStart - arrival) / ENTRANCE_FADE_S));
            if (entrance <= 0) continue;
          }

          let ripple = 0;
          for (const rp of ripples) {
            const e = time - rp.t;
            if (e < 0 || e >= RIPPLE_S) continue;
            const k = e / RIPPLE_S;
            const wave = smooth(0, 1, k) * maxR;
            const bell = 1 - smooth(0, 3 * ch, Math.abs(Math.hypot(x - rp.x, y - rp.y) - wave));
            ripple = Math.max(ripple, bell * smooth(0, 0.22, k) * (1 - smooth(0.78, 1, k)));
          }

          const hover = (1 - smooth(0, radius, Math.hypot(x - mouse.x, y - mouse.y))) * mouse.influence;
          opacity *= 1 - hover;
          if (hover > 0.001 && threshold < hover * 2.5) opacity = 0;
          const boost = ripple > 0.001 && threshold < ripple * 0.5;
          if (boost) opacity = 1;
          opacity *= entrance;
          if (opacity < 0.03) continue;

          let gi = glyphs.indexOf(phrase[(c + rowOffset[r]) % phrase.length]);
          const flip = !reduce && inModel && Math.sin(time * FLIP_HZ * Math.PI * 2 + threshold * 6.283) * 0.5 + 0.5 > FLIP_THRESHOLD;
          if (flip) gi = 1 + Math.floor(hash1(threshold * 17.13 + flipFrame * 1.7) * (glyphs.length - 1));
          if (boost) gi = 1 + Math.floor(hash1(threshold * 7.13 + scrambleFrame) * (glyphs.length - 1));

          const lvl = accent && b > 0.93 && !boost ? LEVELS : Math.min(LEVELS - 1, Math.round(opacity * LEVELS) - 1);
          if (lvl < 0) continue;
          ctx.drawImage(atlas, gi * sw, lvl * sh, sw, sh, Math.round(c * cw * dpr), Math.round(r * ch * dpr), sw, sh);
        }
      }
      for (let i = ripples.length - 1; i >= 0; i--) if (time - ripples[i].t > RIPPLE_S) ripples.splice(i, 1);
    };

    const loop = (now: number) => {
      if (!visible) return;
      if (now - last >= 1000 / FPS) { last = now; draw(now); }
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
    }, { threshold: 0.15 });
    io.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.target = 1;
    };
    const onLeave = () => { mouse.target = 0; };
    const onClick = (e: PointerEvent) => {
      if (reduce) return;
      const r = canvas.getBoundingClientRect();
      ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: (performance.now() - started) / 1000 });
      if (ripples.length > 16) ripples.shift();
    };
    const onResize = () => { relayout(); if (reduce) draw(performance.now()); };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(() => { if (img) { relayout(); if (reduce) draw(performance.now()); } });

    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
      window.removeEventListener("resize", onResize);
    };
  }, [src, phrase, color, accent, layout]);

  return <canvas ref={ref} className={className} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden="true" />;
}
