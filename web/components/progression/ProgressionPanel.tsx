"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/gui";

export interface ProgressionSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The frame shared by the Journal / Contribute / Letters / Notice / wallet sheets: the GUI kit's one dialog frame. The
 * portal's pages use the bodies, not this. `icon` goes in its header.
 */
export default function ProgressionPanel({ open, onClose, title, wide, keys, icon, children }: ProgressionSheetProps & {
  title: string; wide?: boolean; keys?: string | readonly string[]; icon?: ReactNode; children: ReactNode;
}) {
  return <Sheet open={open} onClose={onClose} title={title} size={wide ? "lg" : "md"} keys={keys} icon={icon} testId="progression-sheet">
    <div data-progression-sheet>{children}</div>
  </Sheet>;
}
