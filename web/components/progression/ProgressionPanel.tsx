"use client";

import { useContext, type ReactNode } from "react";
import { Sheet } from "@/components/gui";
import { MenuPaletteContext } from "@/components/gui/variant";

export interface ProgressionSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The frame shared by the Journal / Contribute / Letters / Notice / wallet sheets: the GUI sheet's one dialog frame, in
 * the cream palette (David, flat UI round 2) unless the menus' palette says flat (MenuPaletteContext, round 3). The
 * portal's pages use the bodies, not this. `icon` and `eyebrow` go in its header.
 */
export default function ProgressionPanel({ open, onClose, title, wide, keys, icon, eyebrow, children }: ProgressionSheetProps & {
  title: string; wide?: boolean; keys?: string | readonly string[]; icon?: ReactNode; eyebrow?: ReactNode; children: ReactNode;
}) {
  const palette = useContext(MenuPaletteContext);
  return <Sheet open={open} onClose={onClose} title={title} size={wide ? "lg" : "md"} keys={keys} icon={icon} eyebrow={eyebrow} testId="progression-sheet" variant={palette}>
    <div data-progression-sheet>{children}</div>
  </Sheet>;
}
