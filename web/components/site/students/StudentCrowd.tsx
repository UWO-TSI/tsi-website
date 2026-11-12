"use client";

import { useEffect, useRef } from "react";

// 162 people for the club's 150+ members, and one more in blue at the end: you.
const COLS = 18;
const ROWS = 9;
// A person is three lines tall and takes three and a half, so the rows sit close like a crowd.
const ROW_LINES = 3.5;
// Each person is three lines of text; near the pointer (or in a click's wave) they throw their arms up.
const STAND = [" o ", "/|\\", "/ \\"];
const CHEER = ["\\o/", " | ", "/ \\"];
const BLUE = "#1d9bf0";
// Mono advance and line height as fractions of the font size.
const ADVANCE = 0.6;
const LEADING = 1.2;
// The pointer lifts the people near it; a click sends a wave of hops out across the crowd.
const REACH = 140;
const HOP = 10;
const WAVE_SPEED = 520;
const WAVE_WIDTH = 50;
const WAVE_S = 1.6;

type Body = { x: number; y: number; lift: number; v: number; you: boolean };

/**
 * The students hero's crowd, in text: one block of little ASCII people, one per member, in the site's mono. They hop
 * and throw their arms up as the pointer passes, a click sends a cheering wave through them, and the blue one at the
 * end (you) bobs and waves on its own. Draws only while on screen and only while something moves; still for reduced
 * motion.
 */
export default function StudentCrowd({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let bodies: Body[] = [];
    let fs = 16, cw = 9.6, lh = 19.2, dpr = 1, raf = 0, visible = false;
    const mouse = { x: -1e4, y: -1e4, active: false };
    const waves: { x: number; y: number; t: number }[] = [];

    const layout = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      // Four characters per person across (three and a gap), ROW_LINES lines down, plus room for you.
      const colsOfChars = COLS * 4 + 2, linesOfText = ROWS * ROW_LINES + 5;
      fs = Math.min(20, w / colsOfChars / ADVANCE, h / linesOfText / LEADING);
      cw = fs * ADVANCE;
      lh = fs * LEADING;
      const x0 = (w - colsOfChars * cw) / 2, y0 = Math.max(0, (h - linesOfText * lh) / 2);
      bodies = [];
      // Every other row sits half a person over, like a crowd rather than a table.
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        bodies.push({ x: x0 + (c * 4 + (r % 2 ? 2 : 0)) * cw, y: y0 + r * ROW_LINES * lh, lift: 0, v: 0, you: false });
      }
      bodies.push({ x: x0 + (COLS * 2 - 1) * cw, y: y0 + (ROWS * ROW_LINES + 0.5) * lh, lift: 0, v: 0, you: true });
    };

    const draw = (now: number) => {
      const t = now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const font = `500 ${fs.toFixed(2)}px "Sohne Mono", ui-monospace, monospace`;
      ctx.font = font;
      ctx.textBaseline = "top";
      let moving = false;
      for (let i = waves.length - 1; i >= 0; i--) if (t - waves[i].t > WAVE_S) waves.splice(i, 1);
      for (const b of bodies) {
        const cx = b.x + 1.5 * cw, cy = b.y + 1.5 * lh;
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

        const cheer = near > 0.35 || wave > 0.3 || (b.you && !reduce && Math.sin(t * 1.6) > 0.6);
        ctx.fillStyle = b.you ? BLUE : `rgba(241, 255, 255, ${(0.34 + 0.62 * near + Math.min(0.3, (b.lift / HOP) * 0.3)).toFixed(3)})`;
        (cheer ? CHEER : STAND).forEach((line, k) => ctx.fillText(line, b.x, b.y + k * lh - b.lift));
        if (b.you) {
          ctx.font = `600 ${(fs * 0.62).toFixed(2)}px "Sohne Mono", ui-monospace, monospace`;
          ctx.fillText("YOU?", b.x - 0.1 * cw, b.y + 3.2 * lh);
          ctx.font = font;
        }
      }
      return moving || waves.length > 0 || mouse.active;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      const busy = draw(now);
      const next = () => { raf = requestAnimationFrame(loop); };
      // Full speed while the crowd moves; otherwise only the blue one bobs, at a gentler rate.
      if (busy) next();
      else if (!reduce) setTimeout(() => { if (visible && !raf) next(); }, 1000 / 24);
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
