"use client";

import { useEffect, useRef } from "react";
import { PERSON_PATH } from "../marks";

// 150 people for the club's 150+ members, and one more in blue at the end: you.
const COLS = 15;
const ROWS = 10;
// The figure's box in PERSON_PATH's coordinates (the Person mark's viewBox).
const VB_X = 470, VB_Y = -5, VB_W = 470, VB_H = 567;
const GREY = [241, 255, 255];
const BLUE = "#1d9bf0";
// The pointer lifts the people near it; a click sends a wave of hops out across the crowd.
const REACH = 130;
const HOP = 9;
const WAVE_SPEED = 520;
const WAVE_WIDTH = 46;
const WAVE_S = 1.6;

type Body = { x: number; y: number; lift: number; v: number; tilt: number; tv: number; you: boolean; seed: number };

/**
 * The students hero's crowd: rows of the Tethos person, one per member. They lean towards the pointer and
 * hop as it passes, a click sends a wave of hops through them, and the blue one at the end (you) bobs on
 * its own. Draws only while on screen and only while something moves; still for reduced motion.
 */
export default function StudentCrowd({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const path = new Path2D(PERSON_PATH);
    let bodies: Body[] = [];
    let size = 20, dpr = 1, raf = 0, visible = false;
    const mouse = { x: -1e4, y: -1e4, active: false };
    const waves: { x: number; y: number; t: number }[] = [];

    const layout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const cellW = Math.min(w / (COLS + 0.5), (h / (ROWS + 1.6)) / 1.25);
      const cellH = cellW * 1.25;
      size = cellW * 0.78;
      const x0 = (w - cellW * COLS) / 2 + cellW / 2, y0 = (h - cellH * (ROWS + 1)) / 2 + cellH / 2;
      bodies = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        // Every other row sits half a step over, like a crowd rather than a table.
        bodies.push({ x: x0 + c * cellW + (r % 2 ? cellW * 0.25 : -cellW * 0.25), y: y0 + r * cellH, lift: 0, v: 0, tilt: 0, tv: 0, you: false, seed: Math.random() * 6.28 });
      }
      bodies.push({ x: x0 + (COLS - 1) * cellW / 2, y: y0 + ROWS * cellH + cellH * 0.15, lift: 0, v: 0, tilt: 0, tv: 0, you: true, seed: 0 });
    };

    const draw = (now: number) => {
      const t = now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = size / VB_H;
      let moving = false;
      for (let i = waves.length - 1; i >= 0; i--) if (t - waves[i].t > WAVE_S) waves.splice(i, 1);
      for (const b of bodies) {
        const dx = mouse.x - b.x, dy = mouse.y - b.y, d = Math.hypot(dx, dy);
        const near = mouse.active ? Math.max(0, 1 - d / REACH) : 0;
        let target = near * near * HOP;
        for (const wv of waves) {
          const e = t - wv.t, R = e * WAVE_SPEED, dd = Math.hypot(b.x - wv.x, b.y - wv.y);
          target = Math.max(target, HOP * 1.4 * Math.exp(-((dd - R) ** 2) / (2 * WAVE_WIDTH * WAVE_WIDTH)) * (1 - e / WAVE_S));
        }
        if (b.you && !reduce) target = Math.max(target, 3 + Math.sin(t * 3.2) * 3);
        b.v = (b.v + (target - b.lift) * 0.22) * 0.72;
        b.lift += b.v;
        const tiltTarget = near * Math.max(-0.35, Math.min(0.35, dx / REACH)) * 0.9;
        b.tv = (b.tv + (tiltTarget - b.tilt) * 0.18) * 0.74;
        b.tilt += b.tv;
        if (Math.abs(b.v) + Math.abs(b.tv) + Math.abs(target - b.lift) > 0.02) moving = true;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(b.x, b.y - b.lift);
        ctx.rotate(b.tilt);
        ctx.scale(s, s);
        ctx.translate(-(VB_X + VB_W / 2), -(VB_Y + VB_H / 2));
        ctx.fillStyle = b.you ? BLUE : `rgba(${GREY[0]}, ${GREY[1]}, ${GREY[2]}, ${(0.26 + 0.6 * near + Math.min(0.3, b.lift / HOP * 0.3)).toFixed(3)})`;
        ctx.fill(path);
        if (b.you) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.font = '500 11px "Sohne Mono", ui-monospace, monospace';
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = BLUE;
          ctx.fillText("YOU?", b.x, b.y + size * 0.62);
        }
      }
      return moving || waves.length > 0 || mouse.active;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      const busy = draw(now);
      // Full speed while the crowd moves; otherwise only the blue one bobs, at a gentler rate.
      const next = () => { raf = requestAnimationFrame(loop); };
      if (busy) next();
      else if (!reduce) setTimeout(() => { if (visible && !raf) next(); }, 1000 / 24);
    };
    const start = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

    layout();
    draw(performance.now());
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
