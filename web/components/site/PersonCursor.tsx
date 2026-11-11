"use client";

import { useEffect, useRef } from "react";
import { Person } from "./marks";

const BURST = "*+#01@%&";

/**
 * The cursor is one person from the Tethos mark (fine pointers only). It grows over links and buttons,
 * dips on press, and a click throws a ring of eight characters outward (420ms).
 */
export default function PersonCursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const root = document.querySelector(".ts");
    root?.classList.add("has-cursor");
    const el = ref.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = -100, y = -100, cx = -100, cy = -100, frame = 0;

    const draw = () => {
      cx += (x - cx) * (reduce ? 1 : 0.35);
      cy += (y - cy) * (reduce ? 1 : 0.35);
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      frame = Math.abs(x - cx) + Math.abs(y - cy) > 0.1 ? requestAnimationFrame(draw) : 0;
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      el.style.opacity = "1";
      const target = e.target as Element | null;
      el.dataset.hover = String(!!target?.closest("a, button, [role='button'], label"));
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const onDown = (e: PointerEvent) => {
      el.dataset.down = "true";
      if (reduce) return;
      const burst = document.createElement("div");
      burst.className = "ts-burst";
      burst.style.left = `${e.clientX}px`;
      burst.style.top = `${e.clientY}px`;
      for (let i = 0; i < 8; i++) {
        const s = document.createElement("span");
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
        const d = 16 + Math.random() * 10;
        s.textContent = BURST[Math.floor(Math.random() * BURST.length)];
        s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
        s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
        burst.appendChild(s);
      }
      document.body.appendChild(burst);
      setTimeout(() => burst.remove(), 460);
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
