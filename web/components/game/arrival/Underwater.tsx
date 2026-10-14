"use client";

/**
 * The arrival's first beat (specs/v1-drop.md §1.1), 4-6 s: black with a muffled heartbeat; dim blue water fades in,
 * light shafts from the surface, the dark hull of a little boat above, bubbles and motes; you drift up toward the light,
 * gasp as you break the surface, and a weathered hand grabs your wrist: Bram's.
 *
 * Painted in the page, not the island's canvas (it stays paused under it): layered gradients and an SVG hull, shafts and
 * bubbles that move with the rise (one CSS variable a frame, no React renders), and the hand insert drawn in the GUI
 * kit's ink like the trip veil's boat. Matte throughout. Sound: lib/game/arrival/arrivalSound.ts.
 */
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { PALETTE, type CharacterLook } from "@/lib/game/character/look";
import { RESIDENT_LOOKS } from "@/lib/content/residentRoster";
import { SURFACE_AT, underwaterBeat } from "@/lib/game/arrival/sequence";
import { bubbles, gasp, heartbeat } from "@/lib/game/arrival/arrivalSound";
import s from "./Underwater.module.css";

/** Heartbeats (s), quickening as you rise; bubble bursts. */
const BEATS = [0.15, 1.05, 1.8, 2.45, 2.95, 3.3];
const BUBBLES = [0.9, 1.9, 2.7, 3.2];
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Bubbles rising past you: lane, size, delay, how long they take (seeded, the same every time). */
const BUBBLE_SET = Array.from({ length: 22 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { x: 30 + r(1) * 40 + (r(2) - 0.5) * 30, size: 6 + r(3) * 22, delay: 0.6 + r(4) * 3.2, dur: 1.4 + r(5) * 1.6, wobble: (r(6) - 0.5) * 40 };
});
const MOTES = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 7.31 + n * 41.97) * 23421.631; return x - Math.floor(x); };
  return { x: r(1) * 100, y: r(2) * 100, size: 1.5 + r(3) * 3, depth: 0.3 + r(4) * 0.9, a: 0.2 + r(5) * 0.45 };
});

export default function Underwater({ startedAt, look, done }: {
  /** When the beat began (performance.now ms): the sequence's clock. */
  startedAt: number;
  /** Your look as it is now (your wrist's skin), before the water shows you. */
  look: CharacterLook;
  /** The beat is over: the overlay fades out over the boat. */
  done: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const bram = useMemo(() => RESIDENT_LOOKS["wharf-keeper"] as { skin: number; colors: Record<string, number> }, []);
  const colours = { "--you": PALETTE.skin[look.skin], "--bram": PALETTE.skin[bram.skin], "--sleeve": PALETTE.outfit[bram.colors.top_stripe_ls ?? 11] } as CSSProperties;
  useEffect(() => {
    let raf = 0, beat = 0, bubble = 0, gasped = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = () => {
      const t = (performance.now() - startedAt) / 1000, el = root.current;
      if (el) {
        const { beat: b, k } = underwaterBeat(t);
        const rise = b === "dark" ? 0 : b === "rise" ? 0.85 * smooth(0, 1, k) : 0.85 + 0.15 * smooth(0, 1, b === "surface" ? k : 1);
        el.style.setProperty("--rise", (reduced ? Math.min(rise, 0.5) : rise).toFixed(4));
        el.style.setProperty("--fade", smooth(0.2, 0.95, t).toFixed(3));
        el.style.setProperty("--surface", (b === "surface" ? smooth(0.25, 0.75, k) : b === "hand" ? 1 : 0).toFixed(3));
        el.style.setProperty("--hand", (b === "hand" ? k : 0).toFixed(4));
        el.dataset.beat = b;
      }
      while (beat < BEATS.length && t >= BEATS[beat]) { heartbeat(0.7 + beat * 0.08); beat++; }
      while (bubble < BUBBLES.length && t >= BUBBLES[bubble]) { bubbles(3 + bubble, 0.5); bubble++; }
      if (!gasped && t >= SURFACE_AT + 0.12) { gasped = true; gasp(); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [startedAt]);

  return <div ref={root} className={s.root} data-done={done || undefined} style={colours} aria-hidden="true" data-testid="arrival-underwater">
    <div className={s.water}>
      <div className={s.glow} />
      <div className={s.caustics} />
      <svg className={s.hull} viewBox="0 0 400 160" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="uw-rim" cx="50%" cy="50%" r="60%">
            <stop offset="55%" stopColor="#fff6d6" stopOpacity="0" />
            <stop offset="80%" stopColor="#fff6d6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff6d6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="uw-keel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d3442" />
            <stop offset="1" stopColor="#0f222e" />
          </linearGradient>
        </defs>
        <ellipse cx="200" cy="80" rx="190" ry="70" fill="url(#uw-rim)" />
        {/* The hull from below: a long lens, its keel down the middle, the transom square at one end, the propeller's shadow. */}
        <path d="M44 80 C 80 34, 270 26, 352 58 L 360 80 L 352 102 C 270 134, 80 126, 44 80 Z" fill="url(#uw-keel)" />
        <path d="M60 80 C 140 76, 270 76, 350 80" stroke="#0a1820" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M352 58 L 360 80 L 352 102" stroke="#284555" strokeWidth="4" fill="none" strokeLinejoin="round" />
        <ellipse cx="372" cy="80" rx="9" ry="14" fill="#0d1d27" />
      </svg>
      <div className={s.shafts}>{[0, 1, 2, 3, 4, 5].map(i => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>
      <div className={s.motes}>{MOTES.map((m, i) => <i key={i} style={{ left: `${m.x}%`, top: `${m.y}%`, width: m.size, height: m.size, opacity: m.a, "--depth": m.depth } as CSSProperties} />)}</div>
      <div className={s.bubbles}>{BUBBLE_SET.map((b, i) => <i key={i} style={{ left: `${b.x}%`, width: b.size, height: b.size, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, "--wobble": `${b.wobble}px` } as CSSProperties} />)}</div>
      <div className={s.vignette} />
    </div>
    <div className={s.flash} />
    {/* The hand: Bram's, weathered, his striped sleeve rolled up, closing round your wrist and pulling. Mitten hands, as the characters have. */}
    <div className={s.insert}>
      <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="uw-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6d9a8" />
            <stop offset="0.55" stopColor="#bcd7d6" />
            <stop offset="1" stopColor="#5f9bb0" />
          </linearGradient>
        </defs>
        <rect width="600" height="400" fill="url(#uw-sky)" />
        <g className={s.spray} fill="#fffbe7" opacity="0.85">
          <circle cx="250" cy="300" r="7" /><circle cx="226" cy="262" r="4" /><circle cx="372" cy="282" r="6" /><circle cx="398" cy="246" r="3.5" />
          <circle cx="300" cy="340" r="9" /><circle cx="196" cy="318" r="5" /><circle cx="420" cy="320" r="5" />
        </g>
        <g className={s.yours}>
          <path d="M262 430 C 258 360, 262 300, 270 246 L 324 246 C 332 300, 338 360, 336 430 Z" fill="var(--you)" stroke="#3a2e22" strokeWidth="5" strokeLinejoin="round" />
          <path d="M262 214 C 258 168, 276 140, 300 140 C 326 140, 340 166, 336 214 C 334 238, 318 252, 298 252 C 278 252, 264 238, 262 214 Z" fill="var(--you)" stroke="#3a2e22" strokeWidth="5" />
          <path d="M262 206 C 244 202, 234 186, 240 172 C 246 162, 258 166, 264 178" fill="var(--you)" stroke="#3a2e22" strokeWidth="5" strokeLinecap="round" />
          <path d="M282 300 C 286 318, 288 330, 287 344" stroke="#fffbe7" strokeWidth="4" strokeLinecap="round" opacity="0.7" fill="none" />
        </g>
        <g className={s.bram}>
          {/* His forearm in from the top right, the sleeve rolled to the elbow in navy and cream stripes. */}
          <path d="M610 -40 C 540 30, 420 150, 352 214 L 392 258 C 452 194, 560 92, 650 20 Z" fill="var(--bram)" stroke="#3a2e22" strokeWidth="5" strokeLinejoin="round" />
          <g clipPath="url(#uw-cuff)">
            <path d="M650 -20 L 560 70 L 610 120 L 700 30 Z" fill="var(--sleeve)" />
            <path d="M572 58 L 622 108 M 590 40 L 640 90 M 608 22 L 658 72" stroke="#fffbe7" strokeWidth="10" />
          </g>
          <clipPath id="uw-cuff"><path d="M650 -20 L 556 74 L 606 124 L 700 30 Z" /></clipPath>
          <path d="M556 74 L 606 124" stroke="#3a2e22" strokeWidth="5" strokeLinecap="round" />
          {/* The grip: his mitten over your wrist, three fingers' creases, the thumb round the far side. */}
          <path d="M342 206 C 312 214, 262 232, 258 262 C 254 290, 296 302, 340 290 C 372 282, 402 262, 396 236 C 392 214, 370 200, 342 206 Z" fill="var(--bram)" stroke="#3a2e22" strokeWidth="5" />
          <path d="M296 252 C 304 264, 306 276, 300 288 M 322 246 C 330 260, 332 272, 326 286 M 348 240 C 356 252, 358 266, 352 278" stroke="#3a2e22" strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.65" />
          <path d="M268 248 C 262 240, 262 230, 270 226" stroke="#3a2e22" strokeWidth="4" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </div>
  </div>;
}
