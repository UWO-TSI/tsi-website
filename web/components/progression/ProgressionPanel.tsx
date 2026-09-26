"use client";

import type { ReactNode } from "react";
import { useWorldDialog } from "@/lib/game/useWorldDialog";
import s from "./progression.module.css";

export interface ProgressionSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Modal shell shared by the Journal / Contribute / Letters / Notice sheets. */
export default function ProgressionPanel({ open, onClose, title, wide, children }: ProgressionSheetProps & { title: string; wide?: boolean; children: ReactNode }) {
  const ref = useWorldDialog(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className={s.backdrop} onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`${s.panel} ${wide ? s.wide : ""}`} data-progression-sheet>
        <div className={s.head}>
          <h2>{title}</h2>
          <button className={s.close} onClick={onClose} aria-label="Close" title="Close (Esc)">×</button>
        </div>
        <div className={s.body}>{children}</div>
      </div>
    </>
  );
}
