"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/gui";

export interface ProgressionSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The frame shared by the Journal / Contribute / Letters / Notice / wallet sheets: the GUI sheet's one dialog frame, in
 * the flat variant (the game's menus, specs/polish/flat-ui.md step 7). The portal's pages use the bodies, not this.
 */
export default function ProgressionPanel({ open, onClose, title, wide, keys, children }: ProgressionSheetProps & { title: string; wide?: boolean; keys?: string | readonly string[]; children: ReactNode }) {
  return <Sheet open={open} onClose={onClose} title={title} size={wide ? "lg" : "md"} keys={keys} testId="progression-sheet" variant="flat">
    <div data-progression-sheet>{children}</div>
  </Sheet>;
}
