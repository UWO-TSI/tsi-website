import type { CSSProperties, ReactNode } from "react";
import f from "./flat.module.css";

/**
 * The volleyball serve's power meter (David 2026-10-30: "instead of normal bar its a triangle shaped top is wider and
 * color different and it slighly zooms in and it shakes a lil as it rises to the top"). Not the fishing cast meter: a
 * triangle, narrow at the foot and wide at the top, its fill warming from sea to coral as it rises, the top band gold.
 * The whole meter leans in (a slight zoom) and trembles harder the fuller it is; at the top (`max`) it flashes gold.
 * The fill moves by a transform, so a caller can drive it every frame. `children` sits under it (a key cue).
 */
export function ServeMeter({ value, max = 0.94, label, children }: { value: number; max?: number; label: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(1, value)), top = v >= max;
  return <div className={f.serveMeter} data-max={top || undefined} style={{ "--v": v, "--max": 1 - max } as CSSProperties}>
    <div className={f.serveTri} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <b /><i /><s />
    </div>
    {top && <em className={f.serveMax}>Max</em>}
    {children}
  </div>;
}
