"use client";

/**
 * The kit's micro animations (David, 2026-10-18: "make sure to have micro animation when switching between tabs and
 * clicking between icons"; specs/polish/flat-ui.md round 2): a marker that slides to the chosen tab or icon. The CSS
 * keeps each move 120 to 200 ms, ease-out, and still under reduced motion.
 */
import { useLayoutEffect, useState, type Ref, type RefObject } from "react";

export type Marker = { x: number; y: number; w: number; h: number };

/** Where `el` sits inside `box` (its scroll included), in px. */
export function markerOf(box: { left: number; top: number; scrollLeft: number; scrollTop: number }, el: { left: number; top: number; width: number; height: number }): Marker {
  return { x: el.left - box.left + box.scrollLeft, y: el.top - box.top + box.scrollTop, w: el.width, h: el.height };
}

/**
 * The chosen child of `box` (matched by `selector`), measured for a sliding marker: null until measured (a static
 * render shows the chosen one's own highlight instead). Re-measured as `key` changes, as the box or any of its
 * children resizes, and as children come and go (a rail that gains a filter moves the others along).
 */
export function useMarker(box: RefObject<HTMLElement | null>, selector: string, key: unknown): Marker | null {
  const [m, setM] = useState<Marker | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const on = el.querySelector<HTMLElement>(selector);
      if (!on) { setM(null); return; }
      const b = el.getBoundingClientRect(), r = on.getBoundingClientRect();
      const next = markerOf({ left: b.left, top: b.top, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop }, r);
      setM(prev => (prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h ? prev : next));
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const watch = () => { ro?.disconnect(); ro?.observe(el); for (const c of Array.from(el.children)) ro?.observe(c); };
    watch();
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => { watch(); measure(); });
    mo?.observe(el, { childList: true });
    return () => { ro?.disconnect(); mo?.disconnect(); };
  }, [box, selector, key]);
  return m;
}

/** One element, two refs (the caller's and our own). */
export function bothRefs<T>(...refs: (Ref<T> | undefined)[]): (el: T | null) => void {
  return el => refs.forEach(r => {
    if (typeof r === "function") r(el);
    else if (r) (r as { current: T | null }).current = el;
  });
}
