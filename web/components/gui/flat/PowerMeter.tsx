import type { CSSProperties, ReactNode } from "react";
import f from "./flat.module.css";

/**
 * A charge meter (the volleyball serve's power bar; the fishing cast meter's shape in the flat look): a soft vertical
 * track on a white card, the fill rising with `value` (0..1), the top `tip` of it a gold zone that the fill turns gold
 * in. `children` sits under it (a key cue). The fill moves by a transform, so a caller can drive it every frame.
 */
export function PowerMeter({ value, tip = 0.92, label, children }: { value: number; tip?: number; label: string; children?: ReactNode }) {
  const v = Math.max(0, Math.min(1, value));
  return <div className={f.meter} data-tip={v >= tip || undefined}>
    <div className={f.meterTrack} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}
      style={{ "--v": v, "--tip": 1 - tip } as CSSProperties}><i /><b /></div>
    {children}
  </div>;
}
