"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import f from "./flat.module.css";

/** One corner: its icon, its name and one plain line on hover; `value` now, `base` the shape drawn faintly behind. */
export interface RadarAxis { label: string; value: number; base?: number; icon?: ReactNode; hint?: string }

/** How long a change slides (linear, David 2026-10-28: "linear shift animation"). */
const SLIDE_MS = 450;

/** Values that slide linearly to each new target instead of jumping (design bible UI 9); none under reduced motion. */
function useSlide(target: readonly number[]): readonly number[] {
  const [shown, setShown] = useState(target);
  const now = useRef(target);
  const key = target.join(",");
  useEffect(() => {
    const to = key.split(",").map(Number), from = now.current.length === to.length ? now.current : to;
    const ms = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : SLIDE_MS, start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = ms ? Math.min(1, (t - start) / ms) : 1;
      now.current = from.map((v, i) => v + (to[i] - v) * k);
      setShown(now.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key]);
  return shown;
}

/** The chart's frame (SVG units): the hex's radius and the ring its corner icons sit on. */
const R = 100, ICON_R = 128, VIEW = { x: -150, y: -146, w: 300, h: 300 };

/**
 * A radar of a few stats graded out of `max` (the rod's hex, David 2026-10-28): thin light rings, the current values as
 * one soft shape in the chart colour, and `base` (the rod alone) faintly behind it, so an add-on shows as the shape
 * growing. A change slides linearly. Each corner carries its icon and value; hovering or focusing it names the stat
 * and says in one line what it does. Its numbers are in the label for screen readers.
 */
export function HexRadar({ axes, max = 100, label, size = 440, className, testId }: {
  axes: readonly RadarAxis[]; max?: number; label: string; size?: number; className?: string; testId?: string;
}) {
  const n = axes.length;
  const values = useSlide(axes.map(a => a.value));
  const at = (i: number, v: number, r = R) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2, k = (Math.max(0, Math.min(max, v)) / max) * r;
    return [Math.cos(a) * k, Math.sin(a) * k] as const;
  };
  const shape = (vs: readonly number[]) => vs.map((v, i) => at(i, v).map(c => c.toFixed(1)).join(",")).join(" ");
  const based = axes.some(a => a.base !== undefined && a.base !== a.value);
  const spoken = axes.map(a => `${a.label} ${a.value}${based && a.base !== undefined && a.base !== a.value ? ` (${a.base} without add-ons)` : ""}`).join(", ");
  return <figure className={`${f.radar} ${className ?? ""}`} style={{ maxWidth: size }} data-testid={testId}>
    <svg viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="img" aria-label={`${label}: ${spoken}, out of ${max}`}>
      {[0.25, 0.5, 0.75, 1].map(k => <polygon key={k} className={f.radarRing} points={axes.map((_, i) => at(i, max * k).join(",")).join(" ")} />)}
      {axes.map((_, i) => { const [x, y] = at(i, max); return <line key={i} className={f.radarRing} x1={0} y1={0} x2={x} y2={y} />; })}
      {based && <polygon className={f.radarBase} points={shape(axes.map(a => a.base ?? a.value))} />}
      <polygon className={f.radarNow} points={shape(values)} />
      {values.map((v, i) => { const [x, y] = at(i, v); return <circle key={i} className={f.radarDot} cx={x} cy={y} r={2.6} />; })}
    </svg>
    {axes.map((a, i) => {
      const [x, y] = at(i, max, ICON_R), gain = a.base !== undefined ? a.value - a.base : 0;
      const place = { left: `${((x - VIEW.x) / VIEW.w) * 100}%`, top: `${((y - VIEW.y) / VIEW.h) * 100}%` } as CSSProperties;
      return <button key={a.label} type="button" className={f.radarCorner} style={place} aria-label={`${a.label} ${a.value}. ${a.hint ?? ""}`}
        data-side={Math.abs(x) < 4 ? undefined : x > 0 ? "right" : "left"}>
        <span className={f.radarIcon} aria-hidden>{a.icon}</span>
        <span className={f.radarValue} aria-hidden>{Math.round(values[i])}{gain > 0 && <small> +{gain}</small>}</span>
        <span className={f.radarTip} role="tooltip"><b>{a.label}</b>{a.hint}</span>
      </button>;
    })}
  </figure>;
}
