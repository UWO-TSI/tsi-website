"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { glitch } from "@/components/site/npo/FaqAscii";
import type { ArchiveProject, ArchiveYear } from "@/lib/site/projects";
import { canvasDpr } from "@/lib/site/perf";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const WIDE = "(min-width: 821px)";
// The cover's character cell, and the letters it may flicker through.
const CW = 5;
const CH = 9;
// A shallow camera, so the files read nearly face on.
const TILT = -8;
// How far the files away from the front are turned edge on (90 would be a full rolodex fin).
const FIN = 58;

/** The file's cover: its short name drawn big in Söhne, sampled per cell and written in the client's own letters. */
function Cover({ mark, client }: { mark: string; client: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const dpr = canvasDpr();
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
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#f1ffff";
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

type File = ArchiveProject & { year: string; note: string; yi: number };

/**
 * One project's file, landscape: the team's photo (or, without one, the client's short name in characters) fills the
 * card, the project sits on a dark fade at the bottom, the year is on the folder tab and the client's logo is stuck on
 * the corner as a sticker. Idle, it floats a little. It
 * reacts to the pointer the way the old pathway fan cards did (components/cards/Interactive3DCard): pointed at, it
 * lifts 50 px and grows to 1.15, tilts up to 15 degrees toward the pointer on a spring, and a shine follows the pointer
 * with a blue glow behind it.
 */
function FileCard({ f, i, n, onPick }: { f: File; i: number; n: number; onPick: (from: DOMRect) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [15, -15]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-15, 15]), { stiffness: 150, damping: 20 });
  const shineX = useTransform(mx, [-0.5, 0.5], [0, 100]), shineY = useTransform(my, [-0.5, 0.5], [0, 100]);
  const shine = useMotionTemplate`radial-gradient(circle at ${shineX}% ${shineY}%, rgba(255,255,255,0.2) 0%, transparent 60%)`;
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left - r.width / 2) / r.width);
    my.set((e.clientY - r.top - r.height / 2) / r.height);
  };
  const leave = () => { setHover(false); mx.set(0); my.set(0); };

  return (
    <li className="st-file" data-year={f.yi} data-on="false" style={{ ["--i" as string]: i }} onClick={() => { const r = ref.current?.getBoundingClientRect(); if (r) onPick(r); }}>
      <motion.div
        ref={ref}
        className="st-file__body"
        animate={{ scale: hover ? 1.15 : 1, y: hover ? -50 : 0, z: hover ? 90 : 0 }}
        transition={{ scale: { type: "spring", stiffness: 300, damping: 25 }, y: { type: "spring", stiffness: 300, damping: 25 }, z: { type: "spring", stiffness: 300, damping: 25 } }}
        onPointerMove={move}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }}
        onPointerLeave={leave}
      >
        {/* Idle, every file floats a little, each on its own beat. */}
        <div className="st-file__float">
          <motion.div className="st-file__card" style={{ rotateX: hover ? rotateX : 0, rotateY: hover ? rotateY : 0 }}>
            <span className="st-file__tab">{f.year}</span>
            <div className="st-file__surface">
              <div className="st-file__bg" data-photo={f.photo ? "" : undefined}>
                {f.photo
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.photo} alt={`The ${f.client} team`} loading="lazy" draggable={false} />
                  : <Cover mark={f.mark} client={f.client} />}
              </div>
              <p className="st-file__meta">
                <span>File {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
                {f.teams && <span>{f.teams} teams</span>}
              </p>
              <div className="st-file__text">
                <h3 className="st-file__client">{f.client}</h3>
                <p className="st-file__built">{f.built}</p>
              </div>
              <motion.span className="st-file__shine" aria-hidden="true" style={{ background: shine }} animate={{ opacity: hover ? 0.6 : 0 }} transition={{ duration: 0.3 }} />
            </div>
            {f.logo && (
              <span className="st-file__sticker" data-dark={f.logoDark || undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.logo} alt={`${f.client} logo`} loading="lazy" draggable={false} />
              </span>
            )}
          </motion.div>
          <motion.span className="st-file__glow" aria-hidden="true" animate={{ opacity: hover ? 1 : 0 }} transition={{ duration: 0.3 }} />
        </div>
      </motion.div>
    </li>
  );
}

/**
 * A file opened: it flies from its place in the ring to the middle of the screen, big, with the team's photo across
 * the top and the project under it. Clicking outside it, the close button or Escape puts it back; the page holds still
 * while it is open.
 */
function FileOpen({ f, i, n, from, onClose }: { f: File; i: number; n: number; from: DOMRect; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    const lenis = (window as unknown as { __lenis?: { stop: () => void; start: () => void } }).__lenis;
    const html = document.documentElement, overflow = html.style.overflow;
    if (lenis) lenis.stop(); else html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", key);
      if (lenis) lenis.start(); else html.style.overflow = overflow;
      before?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const w = Math.min(window.innerWidth - 32, 780);
  const dx = from.left + from.width / 2 - window.innerWidth / 2, dy = from.top + from.height / 2 - window.innerHeight / 2, k = from.width / w;
  const spring = { type: "spring" as const, stiffness: 260, damping: 28 };

  return (
    <motion.div className="st-open" role="dialog" aria-modal="true" aria-labelledby={`st-open-${f.slug}`} onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
      <motion.article className="st-open__card" data-year={f.yi} style={{ width: w }} onClick={(e) => e.stopPropagation()}
        initial={{ x: dx, y: dy, scale: k }} animate={{ x: 0, y: 0, scale: 1 }} exit={{ x: dx, y: dy, scale: k, opacity: 0 }} transition={spring}>
        <span className="st-file__tab">{f.year}</span>
        <div className="st-open__head">
        <div className="st-open__photo">
          {f.photo
            ? // eslint-disable-next-line @next/next/no-img-element
              <img src={f.photo} alt={`The ${f.client} team`} />
            : <Cover mark={f.mark} client={f.client} />}
        </div>
        {f.logo && (
          <span className="st-file__sticker st-open__sticker" data-dark={f.logoDark || undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.logo} alt={`${f.client} logo`} />
          </span>
        )}
        </div>
        <div className="st-open__text">
          <p className="st-open__meta">
            <span>File {String(i + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
            <span>{f.year} · {f.note}</span>
            {f.teams && <span>{f.teams} teams</span>}
          </p>
          <h3 className="st-open__client" id={`st-open-${f.slug}`}>{f.client}</h3>
          <p className="st-open__built">{f.built}</p>
        </div>
        <button ref={closeRef} type="button" className="st-open__close" onClick={onClose}>Close <kbd>Esc</kbd></button>
      </motion.article>
    </motion.div>
  );
}

/**
 * Every project as a file in a card index (David's references: a ring of cards you scroll through, and folders with
 * their files peeking out). On wide screens the section pins and the files stand in a tilted ring, edge on like a
 * rolodex; scrolling turns the ring, and the file at the front swings out to face you, so each scroll step brings up
 * the next project. The year it belongs to stands big in the corner and glitches when it changes; the chips jump to a
 * year. Dragging takes hold of the ring itself: it turns and tips with the pointer, spins on when let go and comes to
 * rest on a file. On narrow screens and for reduced motion the files are a row you swipe through.
 */
export default function ProjectArchive({ years }: { years: readonly ArchiveYear[] }) {
  const section = useRef<HTMLElement>(null);
  const ring = useRef<HTMLOListElement>(null);
  const yearRef = useRef<HTMLElement>(null);
  const noteRef = useRef<HTMLSpanElement>(null);
  const trigger = useRef<ScrollTrigger | null>(null);
  const view = useRef<HTMLDivElement>(null);
  // Set when a press turned into a drag, so letting go over a file doesn't also open it.
  const dragged = useRef(false);
  const files = useMemo(() => years.flatMap((y, yi) => y.projects.map((p) => ({ ...p, year: y.year, note: y.note, yi }))), [years]);
  const firsts = useMemo(() => years.map((_, yi) => files.findIndex((f) => f.yi === yi)), [years, files]);
  const [active, setActive] = useState(0);
  const activeYear = files[active]?.yi ?? 0;

  useEffect(() => {
    const el = section.current!, list = ring.current!, vw = view.current!;
    const cards = Array.from(list.querySelectorAll<HTMLElement>(".st-file"));
    const n = cards.length, step = 360 / n;
    const wide = window.matchMedia(WIDE);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ease = (x: number) => x * x * (3 - 2 * x);
    const wrap = (x: number) => ((x % n) + n) % n;
    const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
    // The ring as one object: `pos` is the file facing you (any real number, the ring being a full circle), `pitch`
    // tips the whole ring toward or away from you, and `swing` is how far the front file stands out of it (none while
    // you hold the ring, so it turns as one piece).
    const st = { pos: 0, pitch: 0, swing: 1 };
    let radius = 520;

    const render = () => {
      if (!wide.matches || reduce) {
        list.style.transform = "";
        cards.forEach((c) => { c.style.transform = ""; c.style.opacity = ""; c.style.pointerEvents = ""; c.dataset.on = "false"; });
        return;
      }
      radius = Math.max(440, Math.min(window.innerWidth * 0.38, 700));
      const tilt = TILT + st.pitch;
      list.style.transform = `translateZ(${-radius}px) rotateX(${tilt.toFixed(2)}deg)`;
      cards.forEach((c, i) => {
        const d = ((((i - st.pos) % n) + n + n / 2) % n) - n / 2;
        // A short swing (within 0.7 of a step), so two neighbours never stand half-turned into each other.
        const a = ease(Math.max(0, 1 - Math.abs(d) / 0.7)) * st.swing;
        // Part edge on in the ring (each side turned so its front shows); the one at the front turns to face you,
        // steps out and rises.
        const ang = d * step;
        const face = FIN * (1 - a) * (ang < 0 ? 1 : -1);
        c.style.transform = `rotateY(${ang.toFixed(2)}deg) translateZ(${(radius + 150 * a).toFixed(1)}px) rotateY(${face.toFixed(2)}deg) rotateX(${(-tilt * a).toFixed(2)}deg) translateY(${(-24 * a).toFixed(1)}px) scale(${(1 + 0.16 * a).toFixed(3)})`;
        c.dataset.on = a > 0.6 ? "true" : "false";
        // The far side of the ring dims away, so it never clutters the files in front.
        const near = Math.min(1, Math.max(0, (Math.cos((ang * Math.PI) / 180) + 0.45) / 0.65));
        c.style.opacity = (0.08 + 0.92 * near).toFixed(3);
        c.style.pointerEvents = near < 0.3 ? "none" : "";
      });
      setActive(wrap(Math.round(st.pos)));
    };

    const lenis = () => (window as unknown as { __lenis?: { scrollTo: (y: number, o: object) => void } }).__lenis;
    const scrollToFile = (f: number, immediate: boolean) => {
      const s = trigger.current;
      if (!s) return;
      const y = s.start + (clamp(f, 0, n - 1) / (n - 1)) * (s.end - s.start) + 1;
      const l = lenis();
      if (l) l.scrollTo(y, immediate ? { immediate: true } : { duration: 0.6 });
      else window.scrollTo({ top: y, behavior: immediate ? "auto" : "smooth" });
    };

    // Scrolling turns the ring; holding it or letting it spin on takes over until it comes to rest on a file, and
    // then the page's scroll position is moved to match, so the two never disagree.
    let mode: "scroll" | "hold" | "coast" = "scroll";
    let settle = 0;
    trigger.current = ScrollTrigger.create({
      trigger: el, start: "top top", end: "bottom bottom",
      onUpdate: (s) => {
        if (mode === "hold") return;
        mode = "scroll";
        st.pos = s.progress * (n - 1);
        render();
        clearTimeout(settle);
        if (!wide.matches || reduce) return;
        // When the scroll comes to rest between two files, the ring settles on the nearer one.
        settle = window.setTimeout(() => {
          const t = trigger.current;
          if (!t || !t.isActive || mode !== "scroll") return;
          const f = t.progress * (n - 1);
          if (Math.abs(f - Math.round(f)) > 0.02) scrollToFile(Math.round(f), false);
        }, 220);
      },
    });
    st.pos = trigger.current.progress * (n - 1);
    render();
    const onResize = () => render();
    window.addEventListener("resize", onResize);
    wide.addEventListener("change", onResize);

    // Holding and spinning: the ring follows the pointer (sideways turns it, up and down tips it), keeps spinning
    // when let go, then eases onto the nearest file and levels out.
    let raf = 0, last = 0, vel = 0;
    const samples: { t: number; pos: number }[] = [];
    const k = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
      last = now;
      if (mode === "hold") {
        st.swing += (0 - st.swing) * k(10, dt);
      } else if (mode === "coast") {
        st.pos += vel * dt;
        vel *= Math.exp(-2.6 * dt);
        const target = Math.round(st.pos);
        if (Math.abs(vel) < 1.5) { vel *= Math.exp(-8 * dt); st.pos += (target - st.pos) * k(9, dt); }
        st.pitch += (0 - st.pitch) * k(6, dt);
        st.swing += (1 - st.swing) * k(5, dt);
        if (Math.abs(vel) < 0.05 && Math.abs(target - st.pos) < 0.002 && Math.abs(st.pitch) < 0.05 && st.swing > 0.995) {
          st.pos = target; st.pitch = 0; st.swing = 1;
          render();
          mode = "scroll";
          raf = 0;
          scrollToFile(wrap(target), true);
          return;
        }
      }
      render();
      raf = mode === "scroll" ? 0 : requestAnimationFrame(loop);
    };
    const run = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

    let press: { x: number; y: number; pos0: number; pitch0: number } | null = null;
    const perFile = () => Math.max(70, Math.min(150, window.innerWidth / 13));
    const down = (e: PointerEvent) => {
      dragged.current = false;
      if (!wide.matches || reduce || e.button !== 0) return;
      press = { x: e.clientX, y: e.clientY, pos0: st.pos, pitch0: st.pitch };
      if (mode === "coast") { mode = "hold"; vel = 0; }
    };
    const move = (e: PointerEvent) => {
      if (!press) return;
      const dx = e.clientX - press.x, dy = e.clientY - press.y;
      if (!dragged.current && Math.hypot(dx, dy) < 5) return;
      if (!dragged.current) { dragged.current = true; mode = "hold"; vw.dataset.dragging = "true"; clearTimeout(settle); run(); }
      st.pos = press.pos0 - dx / perFile();
      st.pitch = clamp(press.pitch0 - dy * 0.12, -32, 18);
      const t = performance.now();
      samples.push({ t, pos: st.pos });
      while (samples.length > 2 && t - samples[0].t > 90) samples.shift();
    };
    const up = () => {
      if (press && dragged.current) {
        const a = samples[0], b = samples[samples.length - 1];
        vel = a && b && b.t > a.t ? clamp(((b.pos - a.pos) / (b.t - a.t)) * 1000, -18, 18) : 0;
        mode = "coast";
        run();
      }
      press = null;
      samples.length = 0;
      delete vw.dataset.dragging;
    };
    vw.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);

    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(raf);
      trigger.current?.kill();
      window.removeEventListener("resize", onResize);
      wide.removeEventListener("change", onResize);
      vw.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
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
    if (dragged.current) return;
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

  // Clicking a file brings it to the front of the ring and opens it in the middle of the screen.
  const [opened, setOpened] = useState<{ i: number; from: DOMRect } | null>(null);
  const pick = (i: number, from: DOMRect) => {
    if (dragged.current) return;
    go(i);
    setOpened({ i, from });
  };
  const close = useCallback(() => setOpened(null), []);

  return (
    <section ref={section} className="st-ring" data-tone="dark" id="projects" aria-labelledby="projects-title" style={{ ["--n" as string]: files.length }}>
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
        <div ref={view} className="st-ring__view">
          <ol ref={ring} className="st-ring__ring">
            {files.map((f, i) => <FileCard key={f.slug} f={f} i={i} n={files.length} onPick={(from) => pick(i, from)} />)}
          </ol>
        </div>
        <p className="st-ring__year" aria-hidden="true">
          <span ref={noteRef}>{years[0].note}</span>
          <b ref={yearRef}>{years[0].year}</b>
        </p>
      </div>
      <AnimatePresence>
        {opened && <FileOpen key={opened.i} f={files[opened.i]} i={opened.i} n={files.length} from={opened.from} onClose={close} />}
      </AnimatePresence>
    </section>
  );
}
