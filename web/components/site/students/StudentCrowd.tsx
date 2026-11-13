"use client";

import { useEffect, useRef } from "react";
import { PERSON_PATH } from "../marks";
import { canvasDpr, lowPower } from "@/lib/site/perf";

// A fine character cell (8 px type), so each small figure has enough cells to read as the person.
const CW = 5;
const CH = 9;
// One person, in cells: the cursor's figure sampled onto a 12 x 8 block (the figure's own proportions).
const SPRITE_W = 12;
const SPRITE_H = 8;
// Three empty columns between people, so their arms never run together.
const GAP_X = 3;
// The words the people are written in, run together with dots so no cell inside a figure is left blank.
const PHRASE = "DEVELOPERS·DESIGNERS·PROJECT·MANAGERS·DIRECTORS·TSI·";
const NOISE = "#%&*+=01<>/";
const WHITE = "#f1ffff";
const BLUE = "#1d9bf0";
// The figure's box in PERSON_PATH's coordinates (the Person mark's viewBox).
const VB_X = 470, VB_Y = -5, VB_W = 470, VB_H = 567;
// The pointer lifts the people near it; a click sends a wave of hops out across the crowd.
const REACH = 150;
const HOP = 12;
const WAVE_SPEED = 520;
const WAVE_WIDTH = 54;
const WAVE_S = 1.6;

type Body = { x: number; y: number; lift: number; v: number; you: boolean; seed: number };

/**
 * The students hero's crowd: the Tethos figure (the cursor) written in small characters, over and over, as one block of
 * text, with one more in blue at the end for you. The people near the pointer brighten and hop, a click sends a wave
 * of hops through the block, a few letters flicker, and the blue one bobs. Draws only while on screen and only while
 * something moves; still for reduced motion.
 */
export default function StudentCrowd({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glyphs = Array.from(new Set((PHRASE + NOISE).split(""))).join("");
    let bodies: Body[] = [];
    let sprite = new Float32Array(SPRITE_W * SPRITE_H);
    let dpr = 1, raf = 0, visible = false;
    let atlas: HTMLCanvasElement | null = null, blue: HTMLCanvasElement | null = null;
    // Each person pre-drawn once per phrase offset (white) and once for you (blue), so a frame stamps whole people.
    let people: HTMLCanvasElement[] = [], you: HTMLCanvasElement | null = null;
    let covered: number[] = [];
    const mouse = { x: -1e4, y: -1e4, active: false };
    const waves: { x: number; y: number; t: number }[] = [];

    /** How much of each cell of the 8 x 6 block the figure covers. */
    const sample = () => {
      const w = SPRITE_W * CW * 4, h = SPRITE_H * CH * 4;
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      const s = Math.min(w / VB_W, h / VB_H) * 0.98;
      g.translate((w - VB_W * s) / 2, (h - VB_H * s) / 2);
      g.scale(s, s);
      g.translate(-VB_X, -VB_Y);
      g.fillStyle = "#fff";
      g.fill(new Path2D(PERSON_PATH));
      const px = g.getImageData(0, 0, w, h).data;
      sprite = new Float32Array(SPRITE_W * SPRITE_H);
      for (let r = 0; r < SPRITE_H; r++) for (let c = 0; c < SPRITE_W; c++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          const x = Math.floor((c * CW + (i + 0.5) * CW / 4) * 4), y = Math.floor((r * CH + (j + 0.5) * CH / 4) * 4);
          sum += px[(y * w + x) * 4 + 3] / 255;
        }
        sprite[r * SPRITE_W + c] = sum / 16;
      }
    };

    const makeAtlas = (color: string) => {
      const sw = Math.ceil(CW * dpr), sh = Math.ceil(CH * dpr);
      const a = document.createElement("canvas");
      a.width = sw * glyphs.length; a.height = sh;
      const g = a.getContext("2d")!;
      g.font = `600 ${Math.round((CH - 1) * dpr)}px "Sohne Mono", ui-monospace, monospace`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color;
      for (let i = 0; i < glyphs.length; i++) g.fillText(glyphs[i], i * sw + sw / 2, sh / 2);
      return a;
    };

    const layout = () => {
      dpr = canvasDpr();
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      sample();
      atlas = makeAtlas(WHITE);
      blue = makeAtlas(BLUE);
      const sw = Math.ceil(CW * dpr), sh = Math.ceil(CH * dpr);
      covered = [];
      for (let i = 0; i < SPRITE_W * SPRITE_H; i++) if (sprite[i] >= 0.12) covered.push(i);
      const person = (src: HTMLCanvasElement, offset: number) => {
        const cv = document.createElement("canvas");
        cv.width = SPRITE_W * sw; cv.height = SPRITE_H * sh;
        const g = cv.getContext("2d")!;
        for (const i of covered) {
          const r = Math.floor(i / SPRITE_W), c = i % SPRITE_W;
          const gi = glyphs.indexOf(PHRASE[(offset + r * SPRITE_W + c) % PHRASE.length]);
          g.globalAlpha = Math.min(1, Math.pow(sprite[i], 0.6));
          g.drawImage(src, gi * sw, 0, sw, sh, c * sw, r * sh, sw, sh);
        }
        return cv;
      };
      people = Array.from({ length: PHRASE.length }, (_, k) => person(atlas!, k));
      // People in rows, a cell apart, every other row half a person over; the last rows leave room for you.
      const stepX = SPRITE_W + GAP_X, stepY = SPRITE_H + 1;
      const cols = Math.max(1, Math.floor((w / CW - SPRITE_W / 2) / stepX));
      const rows = Math.max(1, Math.floor((h / CH - SPRITE_H - 3) / stepY));
      const blockW = (cols * stepX + SPRITE_W / 2) * CW, blockH = (rows * stepY + SPRITE_H + 3) * CH;
      const x0 = Math.round((w - blockW) / 2 / CW) * CW, y0 = Math.round(Math.max(0, (h - blockH) / 2) / CH) * CH;
      bodies = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        bodies.push({ x: x0 + (c * stepX + (r % 2 ? SPRITE_W / 2 : 0)) * CW, y: y0 + r * stepY * CH, lift: 0, v: 0, you: false, seed: Math.random() * 6.28 });
      }
      bodies.push({ x: x0 + Math.round((blockW / CW - SPRITE_W) / 2) * CW, y: y0 + rows * stepY * CH + CH, lift: 0, v: 0, you: true, seed: 0 });
      you = person(blue, ((bodies.length - 1) * 7) % PHRASE.length);
    };

    const draw = (now: number) => {
      if (!atlas || !blue) return false;
      const t = now / 1000;
      const sw = Math.ceil(CW * dpr), sh = Math.ceil(CH * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let moving = false;
      for (let i = waves.length - 1; i >= 0; i--) if (t - waves[i].t > WAVE_S) waves.splice(i, 1);
      const flipFrame = Math.floor(t * 2.5);
      bodies.forEach((b, n) => {
        const cx = b.x + (SPRITE_W * CW) / 2, cy = b.y + (SPRITE_H * CH) / 2;
        const near = mouse.active ? Math.max(0, 1 - Math.hypot(mouse.x - cx, mouse.y - cy) / REACH) : 0;
        let wave = 0;
        for (const wv of waves) {
          const e = t - wv.t, R = e * WAVE_SPEED, d = Math.hypot(cx - wv.x, cy - wv.y);
          wave = Math.max(wave, Math.exp(-((d - R) ** 2) / (2 * WAVE_WIDTH * WAVE_WIDTH)) * (1 - e / WAVE_S));
        }
        let target = Math.max(near * near * HOP, HOP * 1.3 * wave);
        if (b.you && !reduce) target = Math.max(target, 3 + Math.sin(t * 3.2) * 3);
        b.v = (b.v + (target - b.lift) * 0.22) * 0.72;
        b.lift += b.v;
        if (Math.abs(b.v) + Math.abs(target - b.lift) > 0.02) moving = true;
        const strength = b.you ? 1 : 0.42 + 0.58 * Math.max(near, wave) + Math.min(0.25, (b.lift / HOP) * 0.25);
        const px = Math.round(b.x * dpr), py = Math.round((b.y - b.lift) * dpr);
        ctx.globalAlpha = Math.min(1, strength);
        ctx.drawImage(b.you ? you! : people[(n * 7) % PHRASE.length], px, py);
        // Now and then one letter of a person flickers to another.
        if (!reduce && !b.you) {
          const h = Math.sin(n * 12.9898 + flipFrame * 78.233) * 43758.5453;
          const f = h - Math.floor(h);
          if (f < 0.12) {
            const i = covered[Math.floor((f / 0.12) * covered.length)], r = Math.floor(i / SPRITE_W), c = i % SPRITE_W;
            const gi = (glyphs.indexOf(PHRASE[(n * 7 + i) % PHRASE.length]) + 1 + flipFrame) % glyphs.length;
            ctx.clearRect(px + c * sw, py + r * sh, sw, sh);
            ctx.globalAlpha = Math.min(1, Math.pow(sprite[i], 0.6) * strength);
            ctx.drawImage(atlas!, gi * sw, 0, sw, sh, px + c * sw, py + r * sh, sw, sh);
          }
        }
        if (b.you) {
          ctx.globalAlpha = 1;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.font = `600 10px "Sohne Mono", ui-monospace, monospace`;
          ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = BLUE;
          ctx.fillText("YOU?", b.x + (SPRITE_W * CW) / 2, b.y + SPRITE_H * CH + 6);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
      });
      ctx.globalAlpha = 1;
      return moving || waves.length > 0 || mouse.active;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      const busy = draw(now);
      const next = () => { raf = requestAnimationFrame(loop); };
      // Full speed while the crowd moves; otherwise only the blue one bobs and a few letters flicker, more gently.
      if (busy) next();
      else if (!reduce) setTimeout(() => { if (visible && !raf) next(); }, 1000 / (lowPower() ? 10 : 20));
    };
    const start = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

    layout();
    draw(performance.now());
    document.fonts?.ready.then(() => { layout(); draw(performance.now()); }, () => {});
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (reduce) draw(performance.now()); else start(); }, { threshold: 0.05 });
    io.observe(canvas);
    const ro = new ResizeObserver(() => { layout(); draw(performance.now()); });
    ro.observe(canvas);

    const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onMove = (e: PointerEvent) => { if (reduce) return; const p = local(e); mouse.x = p.x; mouse.y = p.y; mouse.active = true; start(); };
    const onLeave = () => { mouse.active = false; start(); };
    const onDown = (e: PointerEvent) => { if (reduce) return; const p = local(e); waves.push({ x: p.x, y: p.y, t: performance.now() / 1000 }); if (waves.length > 4) waves.shift(); start(); };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    return () => {
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return <canvas ref={ref} className={className} style={{ width: "100%", height: "100%", display: "block" }} aria-hidden="true" />;
}
