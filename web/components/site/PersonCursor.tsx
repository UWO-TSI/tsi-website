"use client";

import { useEffect, useRef } from "react";
import { Person } from "./marks";

const BURST = "*+#01@%&<>/=:";
const SPRAY = 16;
// How much of the gap to the pointer it closes each frame (lower trails further behind).
const DRAG = 0.17;
const MAX_LEAN = 42;

/**
 * The cursor is one person from the Tethos mark (fine pointers only). It trails the pointer and swings as
 * it is dragged; over links and buttons it turns blue, grows and gets a faint ring; it dips on press, and
 * a click sprays 16 blue characters that fly out, arc and fall as they fade.
 */
export default function PersonCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const root = document.querySelector(".ts");
    root?.classList.add("has-cursor");
    const el = ref.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = -100, y = -100, cx = -100, cy = -100, lean = 0, spin = 0, frame = 0;

    const draw = () => {
      // It trails the pointer, and swings on a spring from its head: it tips well over when dragged
      // sideways, overshoots when the pointer stops, and wobbles back upright.
      cx += (x - cx) * (reduce ? 1 : DRAG);
      cy += (y - cy) * (reduce ? 1 : DRAG);
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      if (!reduce) {
        const target = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, (x - cx) * 1.6));
        spin = (spin + (target - lean) * 0.16) * 0.8;
        lean += spin;
        el.style.setProperty("--lean", `${lean.toFixed(2)}deg`);
      }
      frame = Math.abs(x - cx) + Math.abs(y - cy) + Math.abs(lean) + Math.abs(spin) > 0.1 ? requestAnimationFrame(draw) : 0;
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      el.style.opacity = "1";
      const target = e.target as Element | null;
      el.dataset.hover = String(!!target?.closest("a, button, [role='button'], label, summary, select, input[type='submit'], input[type='checkbox'], input[type='radio']"));
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onDown = (e: PointerEvent) => {
      el.dataset.down = "true";
      if (reduce) return;
      const burst = document.createElement("div");
      burst.className = "ts-burst";
      burst.style.left = `${e.clientX}px`;
      burst.style.top = `${e.clientY}px`;
      for (let i = 0; i < SPRAY; i++) {
        const s = document.createElement("span");
        const a = (i / SPRAY) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
        const d = 18 + Math.random() * 36;
        s.textContent = BURST[Math.floor(Math.random() * BURST.length)];
        s.style.setProperty("--dx", `${(Math.cos(a) * d).toFixed(1)}px`);
        s.style.setProperty("--dy", `${(Math.sin(a) * d).toFixed(1)}px`);
        s.style.setProperty("--d", `${Math.round(Math.random() * 70)}ms`);
        s.style.setProperty("--t", `${Math.round(420 + Math.random() * 260)}ms`);
        burst.appendChild(s);
      }
      document.body.appendChild(burst);
      setTimeout(() => burst.remove(), 800);
    };
    const onUp = () => { el.dataset.down = "false"; };
    const onLeave = () => { el.style.opacity = "0"; };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      root?.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className="ts-cursor" style={{ opacity: 0 }} aria-hidden="true">
      <Person />
    </div>
  );
}
