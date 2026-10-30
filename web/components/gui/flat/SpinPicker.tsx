import type { CSSProperties, ReactNode } from "react";
import f from "./flat.module.css";

/**
 * Where on the ball to hit (David 2026-10-30: "add a ui for where on the volleyball to hit for curve ball"): the ball's
 * picture with a marker on the contact point (`x`, `y`: −1..1, right and up). Off centre to the side curves the serve
 * away from that side; the top dives, the bottom floats. `children` sits under it (the key cue).
 */
export function SpinPicker({ x, y, picture, label, children }: { x: number; y: number; picture: string; label: string; children?: ReactNode }) {
  const off = Math.hypot(x, y) > 0.08;
  return <div className={f.spin} role="img" aria-label={label} style={{ "--sx": x, "--sy": y } as CSSProperties} data-off={off || undefined}>
    <div className={f.spinBall}><img src={picture} alt="" width={84} height={84} draggable={false} /><i /></div>
    {children}
  </div>;
}
