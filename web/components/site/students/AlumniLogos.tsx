"use client";

import { useEffect, useRef } from "react";
import Reveal from "@/components/site/Reveal";
import type { WallLogo } from "@/lib/site/projects";

// The page's fine cell; a wide wordmark that would come out only a few rows tall gets a finer one.
const CELL = { cw: 5, ch: 9 };
const FINE = { cw: 3.5, ch: 6.3 };
const MIN_ROWS = 8;
const NOISE = "#%&*+=01<>/";
const WHITE = "#f1ffff";
const SETTLE_MS = 520;

/**
 * One company's logo written in characters: the logo is drawn, cropped to its ink and sampled per cell (darker ink
 * reads as denser, so white letters in a logo stay open), and every inked cell spells the company's name. Pointing at
 * it turns it blue, each cell flickering through noise before it settles. Draws only when something changes.
 */
function LogoGlyph({ name, src, dense = false }: { name: string; src: string; dense?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const tile = canvas.parentElement!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fill = name.toUpperCase().replace(/\s+/g, "") + "·";
    let cover = new Float32Array(0), cols = 0, rows = 0, dpr = 1, raf = 0, CW = CELL.cw, CH = CELL.ch;
    let img: HTMLImageElement | null = null;
    let hot = false, t0 = 0;
    let settle = new Float32Array(0);

    /** How much ink each cell holds, with the logo cropped to its ink and fitted inside the tile. */
    const sample = () => {
      if (!img) return;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const S = 480 / Math.max(img.naturalWidth || 240, img.naturalHeight || 240);
      const iw = Math.round((img.naturalWidth || 240) * S), ih = Math.round((img.naturalHeight || 240) * S);
      const off = document.createElement("canvas");
      off.width = iw; off.height = ih;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, iw, ih);
      const px = g.getImageData(0, 0, iw, ih).data;
      const ink = new Float32Array(iw * ih);
      let x0 = iw, y0 = ih, x1 = 0, y1 = 0, max = 0;
      for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
        const i = (y * iw + x) * 4, a = px[i + 3] / 255;
        const v = a * (1 - (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255);
        ink[y * iw + x] = v;
        if (a > 0.05) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        if (v > max) max = v;
      }
      if (x1 <= x0 || !max) return;
      // Fit the inked box into the tile, leaving a cell of air all round, on the finer grid if it would be too short.
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const fit = (cell: { cw: number; ch: number }) => {
        const cc = Math.floor(w / cell.cw), rr = Math.floor(h / cell.ch);
        return { cc, rr, k: Math.min(((cc - 2) * cell.cw) / bw, ((rr - 2) * cell.ch) / bh) };
      };
      let f = fit(CELL), cell = CELL;
      if (dense || (bh * f.k) / CELL.ch < MIN_ROWS) { cell = FINE; f = fit(FINE); }
      CW = cell.cw; CH = cell.ch; cols = f.cc; rows = f.rr;
      const k = f.k;
      const ox = (cols * CW - bw * k) / 2, oy = (rows * CH - bh * k) / 2;
      cover = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
          const sx = Math.floor(x0 + ((c * CW + (i + 0.5) * CW / 3) - ox) / k), sy = Math.floor(y0 + ((r * CH + (j + 0.5) * CH / 3) - oy) / k);
          if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) sum += ink[sy * iw + sx] / max;
        }
        cover[r * cols + c] = sum / 9;
      }
      settle = Float32Array.from({ length: cols * rows }, () => Math.random() * SETTLE_MS);
    };

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cols * CW + CW, rows * CH + CH);
      ctx.font = `500 ${CH - 1}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const t = now - t0;
      let busy = false;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, v = cover[i];
        if (v < 0.14) continue;
        const flicker = hot && !reduce && t < settle[i];
        if (flicker) busy = true;
        const ch = v < 0.3 ? "." : flicker ? NOISE[Math.floor(Math.random() * NOISE.length)] : fill[(r * cols + c) % fill.length];
        ctx.fillStyle = WHITE;
        ctx.globalAlpha = v < 0.3 ? 0.3 : Math.min(1, 0.32 + v * 0.68);
        ctx.fillText(ch, c * CW + CW / 2, r * CH + CH / 2 + 0.5);
      }
      ctx.globalAlpha = 1;
      return busy;
    };
    const run = () => {
      cancelAnimationFrame(raf);
      const step = (now: number) => { raf = draw(now) ? requestAnimationFrame(step) : 0; };
      raf = requestAnimationFrame(step);
    };

    const load = new Image();
    load.onload = () => { img = load; sample(); run(); };
    load.src = src;
    document.fonts?.ready.then(() => { if (img) run(); }, () => {});
    const ro = new ResizeObserver(() => { if (img) { sample(); run(); } });
    ro.observe(canvas);
    const enter = () => { hot = true; t0 = performance.now(); run(); };
    const leave = () => { hot = false; run(); };
    tile.addEventListener("pointerenter", enter);
    tile.addEventListener("pointerleave", leave);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); tile.removeEventListener("pointerenter", enter); tile.removeEventListener("pointerleave", leave); };
  }, [name, src, dense]);

  return <canvas ref={ref} className="st-logo__glyph" aria-hidden="true" />;
}

/**
 * A wall of logos, each written in characters with its name underneath: where members and alumni have worked (on
 * /students), and the nonprofits teams have built for (on /npo). Pointing at one turns its tile white and shows the
 * real logo in its own colours; a nonprofit's tile opens its website.
 */
export default function AlumniLogos({ companies, id = "alumni", title = "Where our members and alumni have worked.", cols = 5, dense = false }: { companies: readonly WallLogo[]; id?: string; title?: string; cols?: number; dense?: boolean }) {
  return (
    <section className="ts-section" data-tone="dark" id={id} aria-labelledby={`${id}-title`}>
      <div className="ts-wrap">
        <Reveal delay={0.06}><h2 className="ts-h2" id={`${id}-title`} style={{ maxWidth: "14em" }}>{title}</h2></Reveal>
        <ul className="st-logos" data-dense={dense || undefined} style={{ ["--cols" as string]: cols }}>
          {companies.map((co, i) => {
            const body = (
              <>
                <div className="st-logo__art">
                  <LogoGlyph name={co.name} src={co.logo} dense={dense} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {co.color && <img className="st-logo__color" src={co.color} alt="" loading="lazy" draggable={false} />}
                </div>
                <span className="st-logo__name">{co.name}</span>
              </>
            );
            return (
              <Reveal as="li" key={co.name} className="st-logo" data-color={co.color ? "" : undefined} delay={0.04 * (i % 5)}>
                {co.href
                  ? <a className="st-logo__in" href={co.href} target="_blank" rel="noopener noreferrer" aria-label={`${co.name}, opens their website`}>{body}</a>
                  : <div className="st-logo__in">{body}</div>}
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
