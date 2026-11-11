"use client";

import { useEffect, useRef } from "react";
import { Person } from "./marks";

/** The cursor is one person from the Tethos mark. Fine pointers only; it grows over links and buttons. */
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
    const onLeave = () => { el.style.opacity = "0"; };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      root?.classList.remove("has-cursor");
      window.removeEventListener("pointermove", onMove);
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
