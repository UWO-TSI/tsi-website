"use client";

import type { ReactNode } from "react";
import { Sheet, useGuiVariant } from "@/components/gui";

export interface ProgressionSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The frame shared by the Journal / Contribute / Letters / Notice / wallet sheets: the GUI sheet's one dialog frame, in
 * the cream palette (David, flat UI round 2), or the clean flat one with `flat` (the redesigned menus, round 3b) and
 * when opened inside a flat one (Contribute from the journal or the notice board: the flat sheet's rules would reach a
 * cream sheet nested in it). The portal's pages use the bodies, not this. `icon` goes in its header.
 */
export default function ProgressionPanel({ open, onClose, title, wide, keys, icon, flat, children }: ProgressionSheetProps & {
  title: string; wide?: boolean; keys?: string | readonly string[]; icon?: ReactNode; flat?: boolean; children: ReactNode;
}) {
  const inFlat = useGuiVariant() === "flat";
  return <Sheet open={open} onClose={onClose} title={title} size={wide ? "lg" : "md"} keys={keys} icon={icon} testId="progression-sheet" variant={flat || inFlat ? "flat" : "cream"}>
    <div data-progression-sheet>{children}</div>
  </Sheet>;
}
