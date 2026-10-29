import type { CSSProperties, ReactNode } from "react";
import f from "./flat.module.css";

/**
 * A small white card with real progress (the island's loading screen): an icon and a title, the stage it waits on in a
 * quiet line, and the progress as a thin ink line filled by a transform, so it keeps moving while the main thread is
 * busy. `value` is 0..1. Its own file, so a page's first chunk takes it without the rest of the kit.
 */
export function ProgressCard({ icon, title, status, value, label }: { icon?: ReactNode; title: ReactNode; status?: ReactNode; value: number; label: string }) {
  return <div className={f.progressCard}>
    {icon && <span className={f.progressIcon} aria-hidden="true">{icon}</span>}
    <div className={f.progressText}><b>{title}</b>{status && <span>{status}</span>}</div>
    <div className={f.progressLine} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}
      style={{ "--p": value } as CSSProperties}><i /></div>
  </div>;
}
