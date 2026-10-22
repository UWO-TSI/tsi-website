"use client";

/**
 * The kit's micro animations (David, 2026-10-18: "make sure to have micro animation when switching between tabs and
 * clicking between icons"; specs/polish/flat-ui.md round 2): a marker that slides to the chosen tab or icon. The CSS
 * keeps each move 120 to 200 ms, ease-out, and still under reduced motion.
 */
import { useCallback, useLayoutEffect, useState, type Ref, type RefObject } from "react";

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

// ── The cells' motion (round 3) ─────────────────────────────────────────────────────────────────────────────────────

/**
 * David, round 3: "hover make a ease in out speed up slow down for the items clicked to slowly budge out a tiny bit to
 * show its selected and push the other cells away for both hover (quicker) select(slower)". A hovered cell grows a
 * little out of the grid and its neighbours step aside (quick); the picked one grows a little further and stays out,
 * its neighbours kept aside (slower). `grow`: px the active cell gains on each side; `push`: px a touching neighbour
 * steps away (more than `grow`, so they make room rather than crowd).
 */
export const NUDGE = { hover: { grow: 3, push: 5 }, select: { grow: 5, push: 8 } } as const;

/** A cell's layout box in px (offsetLeft/Top/Width/Height: where the grid put it, before any transform). */
export type CellBox = { x: number; y: number; w: number; h: number };
export type Nudge = { x: number; y: number; s: number };
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * How `cell` moves for `active` growing out of the grid: the active cell itself only grows (its scale, so its sides
 * gain `grow` px); the eight round it step straight away from it, `push` px for the four touching, less for the
 * corners, a hair for the ring after, and nothing past that. Distances count in the active cell's own size, so tall
 * cards and small ones behave alike.
 */
export function nudgeOf(cell: CellBox, active: CellBox, { grow, push }: { grow: number; push: number }): Nudge {
  const dx = (cell.x + cell.w / 2 - (active.x + active.w / 2)) / Math.max(active.w, 1);
  const dy = (cell.y + cell.h / 2 - (active.y + active.h / 2)) / Math.max(active.h, 1);
  const r = Math.hypot(dx, dy);
  if (r < 0.01) return { x: 0, y: 0, s: 1 + Math.round((2 * grow * 1000) / Math.max(active.w, active.h, 1)) / 1000 };
  const k = Math.max(0, Math.min(1, 1 - (r - 1.1) / 1.4));
  return k ? { x: r1((push * k * dx) / r), y: r1((push * k * dy) / r), s: 1 } : { x: 0, y: 0, s: 1 };
}

const HOVER_LEAVE_MS = 80;
const VARS = ["--nudge-hx", "--nudge-hy", "--nudge-hs", "--nudge-sx", "--nudge-sy", "--nudge-ss"] as const;
const put = (el: HTMLElement, name: string, v: number, rest: number, unit: string) => {
  const next = v === rest ? "" : `${v}${unit}`;
  if (el.style.getPropertyValue(name) !== next) { if (next) el.style.setProperty(name, next); else el.style.removeProperty(name); }
};
/** A cell you can act on (a card that is an enabled button, or holds one); an empty slot or a spent piece stays still. */
const live = (el: HTMLElement) => el.matches("button:not(:disabled)") || !!el.querySelector("button:not(:disabled)");

/**
 * The cells' motion for a grid whose children are its cells: a callback ref for the grid (pair it with the kit's
 * `NUDGE_GRID` class, which turns the numbers into transforms). It writes each cell's offsets as CSS variables, only
 * where they change; the CSS eases them (in and out, quick for a hover, slower for a pick) and holds still under
 * reduced motion. The picked cell is the one holding `[data-selected]` (ItemCard's `selected`), watched as it moves;
 * a hover is a mouse or pen over a cell (a touch only picks). Transforms only: nothing reflows.
 */
export function useNudge(): (grid: HTMLElement | null) => (() => void) | void {
  return useCallback((grid: HTMLElement | null) => {
    if (!grid) return;
    let hovered: HTMLElement | null = null, leave = 0;
    const cellOf = (t: EventTarget | null): HTMLElement | null => {
      let el = t instanceof Element ? t : null;
      while (el && el.parentElement !== grid) el = el.parentElement;
      return el instanceof HTMLElement ? el : null;
    };
    const apply = () => {
      const cells = Array.from(grid.children) as HTMLElement[];
      // Every read before any write.
      const boxes = cells.map<CellBox>(el => ({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }));
      const si = cells.findIndex(el => el.matches("[data-selected]") || !!el.querySelector("[data-selected]"));
      const hi = hovered ? cells.indexOf(hovered) : -1;
      const h = hi >= 0 && hi !== si ? boxes[hi] : null, s = si >= 0 ? boxes[si] : null;
      cells.forEach((el, i) => {
        const hn = h ? nudgeOf(boxes[i], h, NUDGE.hover) : null, sn = s ? nudgeOf(boxes[i], s, NUDGE.select) : null;
        put(el, VARS[0], hn?.x ?? 0, 0, "px"); put(el, VARS[1], hn?.y ?? 0, 0, "px"); put(el, VARS[2], hn?.s ?? 1, 1, "");
        put(el, VARS[3], sn?.x ?? 0, 0, "px"); put(el, VARS[4], sn?.y ?? 0, 0, "px"); put(el, VARS[5], sn?.s ?? 1, 1, "");
        const on = i === si ? "select" : i === hi && h ? "hover" : null;
        if (el.getAttribute("data-nudge") !== on) { if (on) el.setAttribute("data-nudge", on); else el.removeAttribute("data-nudge"); }
      });
    };
    const hover = (cell: HTMLElement | null) => {
      window.clearTimeout(leave);
      if (cell === hovered) return;
      hovered = cell;
      apply();
    };
    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const cell = cellOf(e.target);
      // Crossing the gap between two cells: wait a beat, so the next cell takes over without a dip.
      if (!cell || !live(cell)) { window.clearTimeout(leave); leave = window.setTimeout(() => hover(null), HOVER_LEAVE_MS); return; }
      hover(cell);
    };
    const out = () => { window.clearTimeout(leave); leave = window.setTimeout(() => hover(null), HOVER_LEAVE_MS); };
    const gone = () => hover(null);
    grid.addEventListener("pointerover", over);
    grid.addEventListener("pointerleave", out);
    grid.addEventListener("pointercancel", gone);
    grid.addEventListener("dragstart", gone);
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(apply);
    mo?.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-selected", "disabled"] });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
    ro?.observe(grid);
    apply();
    return () => {
      window.clearTimeout(leave);
      grid.removeEventListener("pointerover", over);
      grid.removeEventListener("pointerleave", out);
      grid.removeEventListener("pointercancel", gone);
      grid.removeEventListener("dragstart", gone);
      mo?.disconnect(); ro?.disconnect();
    };
  }, []);
}
