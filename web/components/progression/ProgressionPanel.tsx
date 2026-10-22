"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/gui";

export interface ProgressionSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The frame shared by the Journal / Contribute / Letters / Notice / wallet sheets: the GUI sheet's one dialog frame, in
 * the cream palette (David, flat UI round 2), or the clean flat one with `flat` (the redesigned menus, round 3b). The
 * portal's pages use the bodies, not this. `icon` and `eyebrow` go in its header.
 */
export default function ProgressionPanel({ open, onClose, title, wide, keys, icon, eyebrow, flat, children }: ProgressionSheetProps & {
  title: string; wide?: boolean; keys?: string | readonly string[]; icon?: ReactNode; eyebrow?: ReactNode; flat?: boolean; children: ReactNode;
}) {
  return <Sheet open={open} onClose={onClose} title={title} size={wide ? "lg" : "md"} keys={keys} icon={icon} eyebrow={eyebrow} testId="progression-sheet" variant={flat ? "flat" : "cream"}>
    <div data-progression-sheet>{children}</div>
  </Sheet>;
}
