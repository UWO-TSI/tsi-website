"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/site/Reveal";
import { PERSON_PATH } from "@/components/site/marks";
import { canvasDpr } from "@/lib/site/perf";

/** Each audience's mark, as the nav draws it: the heart (nonprofits), the spark (GENESIS) and the Tethos person. */
const HEART = "M12 20.6c-.3 0-.5-.1-.7-.3C7.2 16.9 3 13.6 3 9.4 3 6.7 5.1 4.6 7.7 4.6c1.8 0 3.3.9 4.3 2.4 1-1.5 2.5-2.4 4.3-2.4 2.6 0 4.7 2.1 4.7 4.8 0 4.2-4.2 7.5-8.3 10.9-.2.2-.4.3-.7.3z";
const SPARK = "M12 2c.9 5.4 3.6 8.1 9 9-5.4.9-8.1 3.6-9 9-.9-5.4-3.6-8.1-9-9 5.4-.9 8.1-3.6 9-9z";

const CARDS = [
  { who: "Nonprofits", line: "Apply for an 8-month build with a student team. The build costs your organization nothing.", go: "See the program", href: "/npo", path: HEART, box: [3, 4.6, 18, 16] },
  { who: "Sponsors", line: "Back the students and their projects, and meet them at GENESIS in March.", go: "Sponsor GENESIS", href: "/genesis", path: SPARK, box: [3, 2, 18, 18] },
  { who: "Students", line: "Join a team and ship software people use. Hiring runs in September and May.", go: "Find your role", href: "/students", path: PERSON_PATH, box: [470, -5, 470, 567] },
] as const;

const CW = 6;
const CH = 11;
const ART = 300;
const NOISE = "#%&*+=01<>/";
const SETTLE_MS = 700;

/**
 * The audience's mark written in characters (the word itself, over and over), in a fixed square so the panel can grow
 * round it without redrawing. Opening the panel makes every character flicker through noise and settle in blue-white;
 * closed, it rests dim.
 */
function MarkGlyph({ path, box, word, open }: { path: string; box: readonly number[]; word: string; open: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ draw: (open: boolean) => void } | null>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = canvasDpr();
    canvas.width = ART * dpr; canvas.height = ART * dpr;
    const cols = Math.floor(ART / CW), rows = Math.floor(ART / CH);
    // How much of each cell the mark covers, from the mark drawn big and sampled 3 x 3 per cell.
    const S = 3, off = document.createElement("canvas");
    off.width = ART * S; off.height = ART * S;
    const g = off.getContext("2d", { willReadFrequently: true })!;
    const [bx, by, bw, bh] = box;
    const k = (ART * S * 0.86) / Math.max(bw, bh);
    g.translate((ART * S - bw * k) / 2, (ART * S - bh * k) / 2);
    g.scale(k, k); g.translate(-bx, -by);
    g.fill(new Path2D(path));
    const px = g.getImageData(0, 0, ART * S, ART * S).data;
    const cover = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
        const x = Math.floor((c * CW + (i + 0.5) * CW / 3) * S), y = Math.floor((r * CH + (j + 0.5) * CH / 3) * S);
        sum += px[(y * ART * S + x) * 4 + 3] / 255;
      }
      cover[r * cols + c] = sum / 9;
    }
    const fill = word.toUpperCase() + "·";
    const settle = Float32Array.from(cover, () => Math.random() * SETTLE_MS);
    let raf = 0;
    const paint = (lit: boolean, t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ART, ART);
      ctx.font = `500 ${CH - 1}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let busy = false;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, v = cover[i];
        if (v < 0.12) continue;
        const flick = lit && !reduce && t < settle[i];
        if (flick) busy = true;
        const ch = v < 0.3 ? "." : flick ? NOISE[(Math.random() * NOISE.length) | 0] : fill[(r * cols + c) % fill.length];
        ctx.fillStyle = !lit ? "#f1ffff" : flick ? "#1d9bf0" : v > 0.85 ? "#f1ffff" : "#9ad7ff";
        ctx.globalAlpha = lit ? Math.min(1, 0.35 + v * 0.7) : Math.min(0.42, 0.12 + v * 0.3);
        ctx.fillText(ch, c * CW + CW / 2, r * CH + CH / 2 + 0.5);
      }
      ctx.globalAlpha = 1;
      return busy;
    };
    state.current = {
      draw: (lit: boolean) => {
        cancelAnimationFrame(raf);
        const t0 = performance.now();
        const step = (now: number) => { raf = paint(lit, now - t0) ? requestAnimationFrame(step) : 0; };
        raf = requestAnimationFrame(step);
      },
    };
    state.current.draw(open);
    document.fonts?.ready.then(() => state.current?.draw(open), () => {});
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, word]);

  useEffect(() => { state.current?.draw(open); }, [open]);

  return <canvas ref={ref} className="wy-art" aria-hidden="true" />;
}

/**
 * One way in for each audience, one panel each. The panel you point at (or tab to) opens wide: its mark, written in characters,
 * flickers awake, and its line and link come up; the others narrow to their name and a dim mark. On narrow screens they
 * stack, all open.
 */
export default function WhoAreYou() {
  const [open, setOpen] = useState(0);
  // Whether the panel under a touch was already open when the touch began (focus lands before the click).
  const press = useRef<{ i: number; wasOpen: boolean; touch: boolean } | null>(null);
  return (
    <section className="ts-section" data-tone="dark" id="audiences" aria-labelledby="audiences-title">
      <div className="ts-wrap">
        <Reveal delay={0.08}><h2 className="ts-h2" id="audiences-title" style={{ maxWidth: "16em" }}>Where do you fit in?</h2></Reveal>
        <Reveal delay={0.12} className="wy-panels">
          {CARDS.map((c, i) => (
            <Link key={c.who} href={c.href} className="wy-panel" data-open={open === i || undefined}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(i); }}
              onPointerDown={(e) => { press.current = { i, wasOpen: open === i, touch: e.pointerType !== "mouse" }; }}
              onFocus={() => { if (!press.current) setOpen(i); }}
              onClick={(e) => {
                const p = press.current;
                press.current = null;
                const side = window.matchMedia("(min-width: 821px)").matches;
                if (p?.touch && side && !(p.i === i && p.wasOpen)) { e.preventDefault(); setOpen(i); }
              }}>
              <span className="wy-panel__num">{String(i + 1).padStart(2, "0")}</span>
              <MarkGlyph path={c.path} box={c.box} word={c.who} open={open === i} />
              <span className="wy-panel__text">
                <span className="wy-panel__who">{c.who}</span>
                <span className="wy-panel__line">{c.line}</span>
                <span className="wy-panel__go">{c.go} <span aria-hidden="true">→</span></span>
              </span>
            </Link>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
