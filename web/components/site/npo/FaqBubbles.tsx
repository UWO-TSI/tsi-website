"use client";

import { useEffect, useRef, useState } from "react";

type Item = { q: string; a: string };
type Body = { x: number; y: number; vx: number; vy: number; r: number; seed: number; popped: boolean };

const SPRAY = "*+#01@%&<>/=:?";
const SPEED = [16, 30] as const;

/** Blue characters thrown out of a popped bubble, like a click on the site. */
function burst(el: HTMLElement, b: Body) {
  const box = document.createElement("div");
  box.className = "np-bub-burst";
  box.style.left = `${b.x}px`;
  box.style.top = `${b.y}px`;
  for (let k = 0; k < 18; k++) {
    const s = document.createElement("span");
    const a = (k / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, d = b.r * (0.8 + Math.random() * 0.7);
    s.textContent = SPRAY[Math.floor(Math.random() * SPRAY.length)];
    s.style.setProperty("--dx", `${(Math.cos(a) * d).toFixed(1)}px`);
    s.style.setProperty("--dy", `${(Math.sin(a) * d).toFixed(1)}px`);
    s.style.setProperty("--d", `${Math.round(Math.random() * 50)}ms`);
    box.appendChild(s);
  }
  el.appendChild(box);
  setTimeout(() => box.remove(), 900);
}

/**
 * The questions as thought bubbles drifting in a jar: they bounce off its walls and off each other, hold still under
 * the pointer, and pop when clicked (a burst of blue characters), which puts the answer in the panel beside them.
 * When every one is popped they can be blown up again. Each bubble is a button; every answer is in the page, the
 * chosen one shown. Still bubbles for reduced motion.
 */
export default function FaqBubbles({ items }: { items: readonly Item[] }) {
  const arena = useRef<HTMLDivElement>(null);
  const bodies = useRef<Body[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [popped, setPopped] = useState<boolean[]>(() => items.map(() => false));
  const [round, setRound] = useState(0);

  // Places the bubbles without overlaps and starts them drifting; again on each new round.
  useEffect(() => {
    const el = arena.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(".np-bub"));
    let w = el.clientWidth, h = el.clientHeight, raf = 0, last = 0, visible = false, hover = -1;

    const place = () => {
      w = el.clientWidth; h = el.clientHeight;
      const scale = Math.min(1, Math.max(0.62, w / 760));
      const list: Body[] = [];
      for (const it of items) {
        const r = Math.round(Math.min(104, Math.max(66, 52 + it.q.length * 1.15)) * scale);
        let x = 0, y = 0;
        for (let t = 0; t < 80; t++) {
          x = r + Math.random() * Math.max(1, w - 2 * r);
          y = r + Math.random() * Math.max(1, h - 2 * r);
          if (list.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 8)) break;
        }
        const a = Math.random() * Math.PI * 2, sp = SPEED[0] + Math.random() * (SPEED[1] - SPEED[0]);
        list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, seed: Math.random() * 6.28, popped: false });
      }
      bodies.current = list;
      nodes.forEach((n, i) => { const b = bodies.current[i]; n.style.width = n.style.height = `${b.r * 2}px`; });
    };

    const draw = (now: number) => {
      const t = now / 1000, list = bodies.current;
      nodes.forEach((n, i) => {
        const b = list[i];
        const s = reduce ? 1 : 1 + Math.sin(t * 1.4 + b.seed) * 0.025;
        n.style.transform = `translate3d(${(b.x - b.r).toFixed(1)}px, ${(b.y - b.r).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      });
    };

    const step = (dt: number) => {
      const list = bodies.current;
      list.forEach((b, i) => {
        if (b.popped || i === hover) return;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
        if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy); }
      });
      // Soft, equal-mass bounces between bubbles.
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], c = list[j];
        if (a.popped || c.popped) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + c.r + 4;
        if (d >= min) continue;
        const nx = dx / d, ny = dy / d, push = (min - d) / 2;
        if (i !== hover) { a.x -= nx * push; a.y -= ny * push; }
        if (j !== hover) { c.x += nx * push; c.y += ny * push; }
        const va = a.vx * nx + a.vy * ny, vc = c.vx * nx + c.vy * ny;
        if (va - vc > 0) { a.vx += (vc - va) * nx; a.vy += (vc - va) * ny; c.vx += (va - vc) * nx; c.vy += (va - vc) * ny; }
      }
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      step(Math.min(0.05, (now - (last || now)) / 1000));
      last = now;
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    place();
    draw(performance.now());
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce && !raf) { last = 0; raf = requestAnimationFrame(loop); }
    }, { threshold: 0.05 });
    io.observe(el);
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - w) < 2 && Math.abs(el.clientHeight - h) < 2) return;
      w = el.clientWidth; h = el.clientHeight;
      bodies.current.forEach((b) => { b.x = Math.min(Math.max(b.r, b.x), w - b.r); b.y = Math.min(Math.max(b.r, b.y), h - b.r); });
      draw(performance.now());
    });
    ro.observe(el);
    const enter = (e: Event) => { hover = nodes.indexOf(e.currentTarget as HTMLElement); };
    const leave = () => { hover = -1; };
    nodes.forEach((n) => { n.addEventListener("pointerenter", enter); n.addEventListener("pointerleave", leave); });
    return () => {
      io.disconnect(); ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      nodes.forEach((n) => { n.removeEventListener("pointerenter", enter); n.removeEventListener("pointerleave", leave); });
    };
  }, [items, round]);

  const pop = (i: number) => {
    const b = bodies.current[i], el = arena.current;
    if (!b || b.popped || !el) return;
    b.popped = true;
    setPopped((p) => p.map((v, k) => v || k === i));
    setSelected(i);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) burst(el, b);
  };

  const left = popped.filter((p) => !p).length;
  const again = () => { setPopped(items.map(() => false)); setSelected(null); setRound((r) => r + 1); };

  return (
    <div className="np-faq2">
      <div className="np-faq2__panel" id="np-faq-answer" aria-live="polite">
        {items.map((it, i) => (
          <div key={it.q} className="np-faq2__answer" hidden={selected !== i}>
            <p className="np-faq2__q">{it.q}</p>
            <p className="np-faq2__a">{it.a}</p>
          </div>
        ))}
        {selected === null && <p className="np-faq2__hint">Pop a question to see its answer.</p>}
        <p className="np-faq2__count">
          {left > 0 ? `${items.length - left} of ${items.length} answered` : "All answered."}
          {left === 0 && <button type="button" onClick={again}>Blow them up again</button>}
        </p>
      </div>
      <div ref={arena} className="np-faq2__jar" key={round}>
        {items.map((it, i) => (
          <button key={it.q} type="button" className="np-bub" data-popped={popped[i] || undefined} aria-controls="np-faq-answer" aria-expanded={selected === i} onClick={() => pop(i)} tabIndex={popped[i] ? -1 : 0}>
            <span>{it.q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
