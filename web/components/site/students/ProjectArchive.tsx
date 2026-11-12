"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { glitch } from "@/components/site/npo/FaqAscii";
import type { ArchiveYear } from "@/lib/site/projects";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const WIDE = "(min-width: 821px)";
// The cover's character cell, and the letters it may flicker through.
const CW = 5;
const CH = 9;
const TILT = -22;

/** The file's cover: its short name drawn big in Söhne, sampled per cell and written in the client's own letters. */
function Cover({ mark, client }: { mark: string; client: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      const cols = Math.floor(w / CW), rows = Math.floor(h / CH);
      const off = document.createElement("canvas");
      off.width = w * 2; off.height = h * 2;
      const g = off.getContext("2d", { willReadFrequently: true })!;
      let size = h * 2 * 0.95;
      g.font = `700 ${size}px "Sohne", sans-serif`;
      const tw = g.measureText(mark).width;
      if (tw > w * 2 * 0.92) { size *= (w * 2 * 0.92) / tw; g.font = `700 ${size}px "Sohne", sans-serif`; }
      g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = "#000";
      const asc = g.measureText(mark).actualBoundingBoxAscent || size * 0.7;
      g.fillText(mark, 2 * CW, (h * 2 + asc) / 2);
      const px = g.getImageData(0, 0, w * 2, h * 2).data;
      const fill = client.toUpperCase().replace(/[^A-Z0-9]/g, "") + "·";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = `500 ${CH - 1}px "Sohne Mono", ui-monospace, monospace`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#0f0f10";
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
          const x = Math.floor((c * CW + (i + 0.5) * CW / 3) * 2), y = Math.floor((r * CH + (j + 0.5) * CH / 3) * 2);
          sum += px[(y * w * 2 + x) * 4 + 3] / 255;
        }
        const v = sum / 9;
        if (v < 0.25) continue;
        ctx.globalAlpha = 0.25 + v * 0.6;
        ctx.fillText(fill[(r * cols + c) % fill.length], c * CW + CW / 2, r * CH + CH / 2 + 0.5);
      }
      ctx.globalAlpha = 1;
    };
    draw();
    document.fonts?.ready.then(draw, () => {});
  }, [mark, client]);
  return <canvas ref={ref} className="st-file__cover" aria-hidden="true" />;
}

/**
 * Every project as a file in a card index (David's references: a ring of cards you scroll through, and folders with
 * their files peeking out). On wide screens the section pins and the files stand in a tilted ring, edge on like a
 * rolodex; scrolling turns the ring, and the file at the front swings out to face you, so each scroll step brings up
 * the next project. The year it belongs to stands big in the corner and glitches when it changes; the chips jump to a
 * year. On narrow screens and for reduced motion the files are a row you swipe through.
 */
export default function ProjectArchive({ years }: { years: readonly ArchiveYear[] }) {
  const section = useRef<HTMLElement>(null);
  const ring = useRef<HTMLOListElement>(null);
  const yearRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const files = useMemo(() => years.flatMap((y, yi) => y.projects.map((p) => ({ ...p, year: y.year, note: y.note, yi }))), [years]);
  const firsts = useMemo(() => years.map((_, yi) => files.findIndex((f) => f.yi === yi)), [years, files]);
  const [active, setActive] = useState(0);
  const activeYear = files[active]?.yi ?? 0;

  useEffect(() => {
    const el = section.current!, list = ring.current!;
    const cards = Array.from(list.querySelectorAll<HTMLElement>(".st-file"));
    const n = cards.length, step = 360 / n;
    const wide = window.matchMedia(WIDE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let radius = 520, last = 0;
    const ease = (x: number) => x * x * (3 - 2 * x);

    const apply = (p: number) => {
      if (!wide.matches || reduce) {
        list.style.transform = "";
        cards.forEach((c) => { c.style.transform = ""; c.dataset.on = "false"; });
        return;
      }
      radius = Math.max(360, Math.min(window.innerWidth * 0.3, 560));
      list.style.transform = `translateZ(${-radius}px) rotateX(${TILT}deg)`;
      const f = p * (n - 1);
      cards.forEach((c, i) => {
        const d = i - f;
        const a = ease(Math.max(0, 1 - Math.abs(d) / 1.15));
        // Edge on in the ring (a quarter turn, each side turned so its front shows); the one at the front turns to
        // face you, steps out and rises.
        const ang = ((((d * step + 180) % 360) + 360) % 360) - 180;
        const face = 90 * (1 - a) * (ang < 0 ? 1 : -1);
        c.style.transform = `rotateY(${ang.toFixed(2)}deg) translateZ(${(radius + 150 * a).toFixed(1)}px) rotateY(${face.toFixed(2)}deg) rotateX(${(-TILT * a).toFixed(2)}deg) translateY(${(-24 * a).toFixed(1)}px) scale(${(1 + 0.16 * a).toFixed(3)})`;
        c.dataset.on = a > 0.6 ? "true" : "false";
      });
      setActive(Math.min(n - 1, Math.max(0, Math.round(f))));
      last = p;
    };

    trigger.current = ScrollTrigger.create({ trigger: el, start: "top top", end: "bottom bottom", onUpdate: (s) => apply(s.progress) });
    apply(trigger.current.progress);
    const onResize = () => apply(trigger.current?.progress ?? last);
    window.addEventListener("resize", onResize);
    wide.addEventListener("change", onResize);
    return () => { trigger.current?.kill(); window.removeEventListener("resize", onResize); wide.removeEventListener("change", onResize); };
  }, [files]);

  // The big year in the corner glitches into the next one.
  const shownYear = useRef(-1);
  useEffect(() => {
    if (shownYear.current === activeYear) return;
    const first = shownYear.current === -1;
    shownYear.current = activeYear;
    // The year's text belongs to these effects, not to the render, so the glitch and React never write the same node.
    if (first) {
      if (yearRef.current) yearRef.current.textContent = years[activeYear].year;
      if (noteRef.current) noteRef.current.textContent = years[activeYear].note;
      return;
    }
    glitch(yearRef.current, years[activeYear].year);
    glitch(noteRef.current, years[activeYear].note);
  }, [activeYear, years]);

  /** Brings file i to the front: scrolls the pinned ring there, or the row on narrow screens. */
  const go = (i: number) => {
    const s = trigger.current;
    if (!s || !window.matchMedia(WIDE).matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ring.current?.querySelectorAll<HTMLElement>(".st-file")[i]?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
      setActive(i);
      return;
    }
    const y = s.start + (i / (files.length - 1)) * (s.end - s.start) + 2;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section ref={section} className="st-ring" data-tone="light" id="projects" aria-labelledby="projects-title" style={{ ["--n" as string]: files.length }}>
      <div className="st-ring__stage">
        <div className="ts-wrap st-ring__head">
          <h2 className="ts-h2" id="projects-title">What teams have built.</h2>
          <div className="st-arch__years" role="group" aria-label="Jump to a year">
            {years.map((y, yi) => (
              <button key={y.year} type="button" aria-pressed={yi === activeYear} onClick={() => go(firsts[yi])}>
                <b>{y.year}</b><span>{y.note}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="st-ring__view">
          <ol ref={ring} className="st-ring__ring">
            {files.map((f, i) => (
              <li key={`${f.year}-${f.client}`} className="st-file" data-year={f.yi} data-on="false" onClick={() => go(i)}>
                <span className="st-file__tab">{f.year}</span>
                <div className="st-file__sheet">
                  <p className="st-file__meta">
                    <span>File {String(i + 1).padStart(2, "0")} / {String(files.length).padStart(2, "0")}</span>
                    {f.teams && <span>{f.teams} teams</span>}
                  </p>
                  <Cover mark={f.mark} client={f.client} />
                  <h3 className="st-file__client">{f.client}</h3>
                  <p className="st-file__built">{f.built}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="st-ring__year" aria-hidden="true">
          <span ref={noteRef}>{years[0].note}</span>
          <b ref={yearRef}>{years[0].year}</b>
        </p>
      </div>
    </section>
  );
}
