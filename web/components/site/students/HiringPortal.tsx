"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { nextHiringOpen } from "@/lib/site/season";
import { canvasDpr, lowPower } from "@/lib/site/perf";

// The swirl's characters, faint to dense, and what a changing digit flickers through.
const RAMP = ".:-=+*#%@";
const NOISE = "#%&*+=01<>/";
const LABELS = ["DAYS", "HOURS", "MINUTES", "SECONDS"];
const WHITE = "#f1ffff";
const BLUE = "#1d9bf0";
const PALE = "#9ad7ff";
// The current's characters, laid along the spiral: flat, falling right, upright, rising right.
const FLOW = "-\\|/";
// 20 frames a second keeps the streams moving smoothly; a low-power machine draws 12.
const FPS = 20;
const FPS_LOW = 12;
// The pointer's pull: how far it reaches, in px.
const PULL = 180;
const GLITCH_MS = 260;

type Cells = { cw: number; ch: number; font: number };
type Slot = { x: number; y: number; ch: string; until: number };
type Sprite = { w: number; h: number; cover: Float32Array };

/** Days, hours, minutes and seconds until `target`, as the clock's four groups (days always three digits). */
function groups(target: number, now: number): string[] {
  const s = Math.max(0, Math.floor((target - now) / 1000));
  const pad = (n: number, k: number) => String(n).padStart(k, "0");
  return [pad(Math.floor(s / 86400), 3), pad(Math.floor(s / 3600) % 24, 2), pad(Math.floor(s / 60) % 60, 2), pad(s % 60, 2)];
}

/**
 * Near the end of the Students page: a portal written in characters, a vortex swirling around a countdown to the day
 * the application portal opens (Sep 10, Toronto time). Characters lie along its spiral arms like a current, comets
 * of them stream in toward the opening, its edge glows like a horizon, and the pointer pulls on it. The digits are big numbers drawn in small ones, on the same grid as
 * the swirl, and each one flickers through noise when it changes. While a round is open it says so instead. Draws only
 * on screen; for reduced motion the swirl holds still and only the digits change.
 */
export default function HiringPortal({ open }: { open: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLDivElement>(null);
  const [target] = useState(() => nextHiringOpen(new Date()));
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "long", day: "numeric", year: "numeric" }).format(target);

  useEffect(() => {
    const canvas = canvasRef.current!, inner = innerRef.current!, clock = clockRef.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const glyphs = Array.from(new Set((RAMP + NOISE + FLOW + "0123456789:OPEN" + LABELS.join("")).split(""))).join("");
    const index = new Map(Array.from(glyphs, (g, i) => [g, i]));
    let cells: Cells = { cw: 8, ch: 14, font: 12 };
    let dpr = 1, cols = 0, rows = 0, raf = 0, last = 0, visible = false;
    let white: HTMLCanvasElement | null = null, blue: HTMLCanvasElement | null = null, pale: HTMLCanvasElement | null = null;
    let sprites = new Map<string, Sprite>();
    let slots: Slot[] = [];
    let labels: { x: number; y: number; text: string }[] = [];
    // The portal's centre and radii, in px; the copy's own box (heading, digits, date), which the swirl fades out around.
    let cx = 0, cy = 0, rx = 1, ry = 1;
    // The vortex's own clocks (they speed up while the pointer is over the section) and the pointer, in canvas px.
    let spin = 0, twist = 0, stream = 0, hover = 0, lastDraw = performance.now();
    const pointer = { x: 0, y: 0, on: false };
    // `hole`: how far in from the rim (in the portal's own units) the swirl is kept off the copy.
    let hole = 0.6;
    // The swirl's cells, worked out once per layout: everything about a cell that doesn't change frame to frame, so a
    // frame only turns the arms (two sines per cell) and draws. Cells that could never show are left out.
    const empty = () => ({ n: 0, c: new Int16Array(0), r: new Int16Array(0), armP: new Float32Array(0), fineP: new Float32Array(0), lnd: new Float32Array(0), rim: new Float32Array(0), halo: new Float32Array(0), edge: new Float32Array(0), flow: new Float32Array(0), keep: new Float32Array(0), dir: new Uint8Array(0), edir: new Uint8Array(0), px: new Float32Array(0), py: new Float32Array(0) });
    let ring = empty();

    const atlas = (color: string) => {
      const sw = Math.ceil(cells.cw * dpr), sh = Math.ceil(cells.ch * dpr);
      const a = document.createElement("canvas");
      a.width = sw * glyphs.length; a.height = sh;
      const g = a.getContext("2d")!;
      g.font = `500 ${Math.round(cells.font * dpr)}px "Sohne Mono", ui-monospace, monospace`;
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color;
      for (let i = 0; i < glyphs.length; i++) g.fillText(glyphs[i], i * sw + sw / 2, sh / 2);
      return a;
    };

    /** How much of each cell a big character covers, drawn in Söhne at `rowsTall` cells high. */
    const sprite = (char: string, rowsTall: number, colsWide: number, fontPx: number, ascent: number): Sprite => {
      const S = 3, w = colsWide * cells.cw * S, h = rowsTall * cells.ch * S;
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      g.font = `600 ${fontPx * S}px "Sohne", sans-serif`;
      g.textAlign = "center"; g.textBaseline = "alphabetic"; g.fillStyle = "#fff";
      g.fillText(char, w / 2, (h + ascent * S) / 2);
      const px = g.getImageData(0, 0, w, h).data;
      const cover = new Float32Array(colsWide * rowsTall);
      const sx = cells.cw * S, sy = cells.ch * S;
      for (let r = 0; r < rowsTall; r++) for (let c = 0; c < colsWide; c++) {
        let sum = 0;
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
          const x = Math.floor(c * sx + (i + 0.5) * sx / 4), y = Math.floor(r * sy + (j + 0.5) * sy / 4);
          sum += px[(y * w + x) * 4 + 3] / 255;
        }
        cover[r * colsWide + c] = sum / 16;
      }
      return { w: colsWide, h: rowsTall, cover };
    };

    const layout = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      dpr = canvasDpr();
      cells = w < 640 ? { cw: 6, ch: 11, font: 9.5 } : { cw: 8, ch: 14, font: 12 };
      const { cw, ch } = cells;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      cols = Math.ceil(w / cw); rows = Math.ceil(h / ch);
      white = atlas(WHITE); blue = atlas(BLUE); pale = atlas(PALE);

      const box = canvas.getBoundingClientRect(), kb = clock.getBoundingClientRect();


      // The clock: four groups in one row, or two rows on a narrow screen; the biggest digits that fit the box.
      const m = document.createElement("canvas").getContext("2d")!;
      m.font = `600 100px "Sohne", sans-serif`;
      const zero = m.measureText("0"), asc100 = zero.actualBoundingBoxAscent || 70, w100 = zero.width;
      const lines: number[][] = open ? [[-1]] : w < 760 ? [[0, 1], [2, 3]] : [[0, 1, 2, 3]];
      const lineWidth = (line: number[], dw: number, sep: number) => open ? 4 * (dw + 1) - 1 : line.reduce((a, g, k) => a + (g === 0 ? 3 : 2) * (dw + 1) - 1 + (k ? sep + 2 : 0), 0);
      const availC = Math.floor(kb.width / cw), availR = Math.floor(kb.height / ch);
      let DH = 4, DW = 3, SEP = 2;
      for (let tall = 16; tall >= 4; tall--) {
        const fontPx = (tall * ch * 0.96 * 100) / asc100;
        const dw = Math.max(3, Math.round((w100 * fontPx) / 100 / cw * 0.9)), sep = Math.max(2, Math.round(dw * 0.45));
        const widest = Math.max(...lines.map((line) => lineWidth(line, dw, sep)));
        const height = lines.length * (tall + (open ? 0 : 3)) + (lines.length - 1) * 2;
        DH = tall; DW = dw; SEP = sep;
        if (widest <= availC && height <= availR) break;
      }
      const fontPx = (DH * ch * 0.96 * 100) / asc100, ascent = (asc100 * fontPx) / 100;
      sprites = new Map();
      for (const c of "0123456789OPEN") sprites.set(c, sprite(c, DH, DW, fontPx, ascent));
      sprites.set(":", sprite(":", DH, SEP, fontPx, ascent));

      slots = []; labels = [];
      const kc = Math.round((kb.left - box.left) / cw), kr = Math.round((kb.top - box.top) / ch);
      const blockH = lines.length * (DH + (open ? 0 : 3)) + (lines.length - 1) * 2;
      let y = kr + Math.floor((availR - blockH) / 2);
      for (const line of lines) {
        let x = kc + Math.floor((availC - lineWidth(line, DW, SEP)) / 2);
        if (open) {
          for (const c of "OPEN") { slots.push({ x, y, ch: c, until: 0 }); x += DW + 1; }
        } else {
          line.forEach((g, k) => {
            if (k) { slots.push({ x: x + 1, y, ch: ":", until: -1 }); x += SEP + 2; }
            const n = g === 0 ? 3 : 2, start = x;
            for (let d = 0; d < n; d++) { slots.push({ x, y, ch: "", until: 0 }); x += DW + 1; }
            const gw = x - 1 - start;
            labels.push({ x: start + Math.floor((gw - LABELS[g].length) / 2), y: y + DH + 2, text: LABELS[g] });
          });
        }
        y += DH + (open ? 0 : 3) + 2;
      }

      // The copy's real extent: the heading's and the date's text (not their full-width boxes) and the digits drawn.
      const textBox = (el: Element | null) => {
        if (!el) return null;
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect();
      };
      let l = Infinity, rgt = -Infinity, top = Infinity, bot = -Infinity;
      for (const b of [textBox(inner.querySelector(".hp__title")), textBox(inner.querySelector(".hp__date, .ts-btn"))]) {
        if (!b || !b.width) continue;
        l = Math.min(l, b.left - box.left); rgt = Math.max(rgt, b.right - box.left); top = Math.min(top, b.top - box.top); bot = Math.max(bot, b.bottom - box.top);
      }
      for (const s of slots) {
        l = Math.min(l, s.x * cw); rgt = Math.max(rgt, (s.x + (s.ch === ":" ? SEP : DW)) * cw);
        top = Math.min(top, s.y * ch); bot = Math.max(bot, (s.y + DH + (open ? 0 : 3)) * ch);
      }
      // The portal is an oval around the copy: wide enough that the copy's corners sit well inside the rim, and the
      // hole kept clear is the same oval shape, so the swirl never ends in a straight line.
      const hw = (rgt - l) / 2 + 2 * cw, hh = (bot - top) / 2 + ch;
      cx = (l + rgt) / 2; cy = (top + bot) / 2;
      rx = Math.max(Math.min(w * 0.42, 820), hw / 0.52);
      ry = Math.max(Math.min(h * 0.34, 420), hh / 0.45);
      hole = Math.hypot(hw / rx, hh / ry) + 0.03;

      // Each cell of the vortex, worked out once: where it sits on the spiral arms, how strong the rim, halo, horizon
      // and inward current are there, and which way the current runs through it (so its character can lie along it).
      const list: number[][] = [];
      const mid = (hole + 0.86) / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = (c + 0.5) * cw, y = (r + 0.5) * ch;
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        const d = Math.hypot(nx, ny);
        if (d < hole || d > 1.9) continue;
        const edges = Math.min(1, r / 10, (rows - 1 - r) / 10, c / 8, (cols - 1 - c) / 8);
        // The swirl fades in over a short stretch outside the hole, and toward the section's edges.
        const fade = Math.min(edges, (d - hole) / 0.1);
        const rimV = Math.exp(-(((d - 0.86) / 0.12) ** 2)) * fade;
        const haloV = (d < 0.86 ? 0.4 * Math.exp(-(((d - 0.68) / 0.05) ** 2)) : 0.4 * Math.exp(-(d - 0.86) / 0.32)) * fade;
        // The event horizon: a thin bright edge right at the opening.
        const edgeV = Math.exp(-(((d - hole) / 0.035) ** 2)) * edges;
        // The current: streams running in along the arms, strongest between the rim and the opening.
        const flowV = Math.exp(-(((d - mid) / 0.32) ** 2)) * Math.min(edges, (d - hole) / 0.05 + 0.2);
        if (rimV + haloV + edgeV + flowV < 0.07) continue;
        const a = Math.atan2(ny, nx), d2 = d * d;
        // The arm's direction through this cell, on screen: along the spiral, at right angles to its phase gradient.
        const gx = (-4 * ny + 7 * nx) / d2 / rx, gy = (4 * nx + 7 * ny) / d2 / ry;
        const th = ((Math.atan2(gx, -gy) % Math.PI) + Math.PI) % Math.PI;
        const dir = Math.round(th / (Math.PI / 4)) % 4;
        // The horizon's direction: round the opening, at right angles to the way out.
        const eth = ((Math.atan2(nx / rx, -ny / ry) % Math.PI) + Math.PI) % Math.PI;
        const edir = Math.round(eth / (Math.PI / 4)) % 4;
        list.push([c, r, 4 * a + 7 * Math.log(d), 13 * a + d * 12, Math.log(d), rimV, haloV, edgeV, flowV, hash(c, r, 0.5), dir, x, y, edir]);
      }
      const n = list.length;
      ring = { n, c: new Int16Array(n), r: new Int16Array(n), armP: new Float32Array(n), fineP: new Float32Array(n), lnd: new Float32Array(n), rim: new Float32Array(n), halo: new Float32Array(n), edge: new Float32Array(n), flow: new Float32Array(n), keep: new Float32Array(n), dir: new Uint8Array(n), edir: new Uint8Array(n), px: new Float32Array(n), py: new Float32Array(n) };
      list.forEach(([c, r, ap, fp, ld, rimV, haloV, edgeV, flowV, k, dir, x, y, edir], i) => {
        ring.c[i] = c; ring.r[i] = r; ring.armP[i] = ap; ring.fineP[i] = fp; ring.lnd[i] = ld; ring.rim[i] = rimV; ring.halo[i] = haloV;
        ring.edge[i] = edgeV; ring.flow[i] = flowV; ring.keep[i] = k; ring.dir[i] = dir; ring.edir[i] = edir; ring.px[i] = x; ring.py[i] = y;
      });
    };

    const hash = (a: number, b: number, c: number) => {
      const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
      return s - Math.floor(s);
    };

    const put = (src: HTMLCanvasElement, g: string, c: number, r: number, alpha: number) => {
      const i = index.get(g);
      if (i === undefined) return;
      const sw = Math.ceil(cells.cw * dpr), sh = Math.ceil(cells.ch * dpr);
      ctx.globalAlpha = alpha;
      ctx.drawImage(src, i * sw, 0, sw, sh, Math.round(c * cells.cw * dpr), Math.round(r * cells.ch * dpr), sw, sh);
    };

    const draw = (now: number) => {
      if (!white || !blue) return;
      const t = reduce ? 0 : now / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { cw, ch } = cells, tick = Math.floor(t * 6);

      // The vortex: log-spiral arms turning on a bright rim, comets of characters streaming in along them toward the
      // opening, a glowing horizon round the opening and a halo thinning outward. The pointer pulls on it: the arms
      // near it brighten and the whole thing turns faster while it is over the section.
      const dt = reduce ? 0 : Math.min(0.1, (now - lastDraw) / 1000);
      lastDraw = now;
      hover += ((pointer.on ? 1 : 0) - hover) * Math.min(1, dt * 3);
      spin += dt * (1.3 + 1.6 * hover); twist += dt * 2.4; stream += dt * (0.85 + 0.9 * hover);
      const sw = Math.ceil(cw * dpr), sh = Math.ceil(ch * dpr);
      const flowIdx = Array.from(FLOW, (g) => index.get(g)!);
      const dense = [index.get("#")!, index.get("@")!, index.get("%")!], soft = [index.get(".")!, index.get(":")!];
      for (let i = 0; i < ring.n; i++) {
        const c = ring.c[i], r = ring.r[i], rimV = ring.rim[i];
        const arms = 0.5 + 0.5 * Math.sin(ring.armP[i] - spin);
        // Sharper crests, with dark lanes between the arms.
        const crest = arms * arms;
        const fine = 0.5 + 0.5 * Math.sin(ring.fineP[i] - twist);
        // A cheap integer hash for the flicker, new six times a second.
        const flick = (Math.imul(c * 73856093 ^ r * 19349663 ^ tick * 83492791, 2654435761) >>> 0) / 4294967296;
        // A comet: its bright head leads inward, its tail trails out behind it, only on an arm's crest.
        let comet = 0;
        if (ring.flow[i] > 0.05 && arms > 0.6) {
          const f = ring.lnd[i] * 5 + stream + 0.25 * Math.sin(ring.armP[i] * 0.5);
          const pf = f - Math.floor(f);
          if (pf < 0.16) comet = (1 - pf / 0.16) * Math.min(1, (arms - 0.6) / 0.25) * ring.flow[i];
        }
        let pull = 0;
        if (pointer.on) {
          const dx = ring.px[i] - pointer.x, dy = ring.py[i] - pointer.y;
          if (dx > -PULL && dx < PULL && dy > -PULL && dy < PULL) pull = Math.max(0, 1 - Math.hypot(dx, dy) / PULL);
        }
        const edgeV = ring.edge[i] * (0.6 + 0.4 * flick) * (0.6 + 0.4 * fine);
        const body = rimV * (0.12 + 0.68 * crest + 0.14 * fine) + ring.halo[i] * crest * (0.5 + 0.5 * flick) + pull * pull * 0.6 * (0.3 + crest);
        const I = body + comet * 1.2 + edgeV;
        if (I < 0.1 || (I < 0.3 && ring.keep[i] > I * 3)) continue;
        // The opening's edge is traced round it; otherwise faint cells are dots, the body of the current lies along the
        // spiral and the brightest are dense.
        const horizon = edgeV > 0.32 && edgeV > body;
        const gi = horizon ? flowIdx[ring.edir[i]] : I >= 0.85 ? dense[(c + r + tick) % 3] : I >= 0.4 ? flowIdx[ring.dir[i]] : soft[I >= 0.24 ? 1 : 0];
        const src = horizon ? (flick > 0.7 ? pale! : blue) : comet > 0.45 || pull > 0.35 ? pale! : rimV > 0.5 && crest > 0.45 ? blue : white;
        ctx.globalAlpha = Math.min(1, 0.1 + I * 1.05);
        ctx.drawImage(src, gi * sw, 0, sw, sh, Math.round(c * cw * dpr), Math.round(r * ch * dpr), sw, sh);
      }

      // The clock, each big digit written in its own small character; a changed digit flickers through noise.
      if (!open) {
        const parts = groups(target.getTime(), Date.now()).join("");
        let k = 0;
        for (const s of slots) if (s.until !== -1) {
          const next = parts[k++];
          if (s.ch !== next) { if (s.ch && !reduce) s.until = now + GLITCH_MS; s.ch = next; }
        }
      }
      for (const s of slots) {
        const sp = sprites.get(s.ch);
        if (!sp) continue;
        const glitching = s.until > now;
        for (let r = 0; r < sp.h; r++) for (let c = 0; c < sp.w; c++) {
          const cover = sp.cover[r * sp.w + c];
          if (cover < 0.16) continue;
          if (s.ch === ":") { put(blue, ":", s.x + c, s.y + r, Math.min(1, cover + 0.2)); continue; }
          if (cover < 0.32) { put(white, ".", s.x + c, s.y + r, 0.35); continue; }
          if (glitching) put(blue, NOISE[Math.floor(Math.random() * NOISE.length)], s.x + c, s.y + r, 1);
          else put(open ? blue : white, s.ch, s.x + c, s.y + r, Math.min(1, 0.3 + cover * 0.8));
        }
      }
      for (const l of labels) for (let i = 0; i < l.text.length; i++) put(white, l.text[i], l.x + i, l.y, 0.5);
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      if (now - last >= 1000 / (reduce ? 4 : lowPower() ? FPS_LOW : FPS)) { last = now; draw(now); }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && visible) raf = requestAnimationFrame(loop); };

    layout();
    draw(performance.now());
    document.fonts?.ready.then(() => { layout(); draw(performance.now()); }, () => {});
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }, { threshold: 0 });
    io.observe(canvas);
    const ro = new ResizeObserver(() => { layout(); draw(performance.now()); });
    ro.observe(canvas);
    const section = canvas.parentElement!;
    const onMove = (e: PointerEvent) => {
      if (reduce || e.pointerType !== "mouse") return;
      const b = canvas.getBoundingClientRect();
      pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top; pointer.on = true;
    };
    const onLeave = () => { pointer.on = false; };
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      io.disconnect(); ro.disconnect(); if (raf) cancelAnimationFrame(raf);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, [open, target]);

  return (
    <section className="ts-section hp" data-tone="dark" id="portal" aria-labelledby="portal-title">
      <canvas ref={canvasRef} className="hp__canvas" aria-hidden="true" />
      <div ref={innerRef} className="hp__inner">
        <h2 className="ts-h2 hp__title" id="portal-title">{open ? "The application portal is open." : "Application portal opens in"}</h2>
        <div ref={clockRef} className="hp__clock" role="timer" aria-label={open ? "Open now" : `Opens ${date}`} />
        {open
          ? <Link href="/student/apply" className="ts-btn ts-btn--primary">See open roles <span className="ts-btn__arrow">→</span></Link>
          : <p className="hp__date" suppressHydrationWarning>{date} · Toronto time</p>}
      </div>
    </section>
  );
}
