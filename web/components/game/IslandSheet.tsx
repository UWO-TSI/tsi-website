"use client";

import { useId, type ReactNode } from "react";
import { Card, Sheet, type SheetSize } from "@/components/gui";

/**
 * An island sheet: the GUI sheet's one dialog frame (components/gui Sheet), so focus, Escape, the opening key
 * (`keys`), the world's hotkeys held, the paper sound and the open and close animation are the same everywhere.
 * `embedded`: inside another page's frame (the portal's Oracle page), a plain paper section.
 */
export default function IslandSheet({ open = true, title, onClose, className, testId, embedded, keys, size, tone, children }: {
  open?: boolean; title: string; onClose?: () => void; className?: string; testId: string; embedded?: boolean; keys?: string | readonly string[];
  size?: SheetSize; tone?: "butter" | "sage" | "oracle"; children: ReactNode;
}) {
  const id = useId();
  if (embedded) return <Card as="section" className={className} aria-labelledby={id} data-testid={testId}>
    <h2 id={id} style={{ margin: "0 0 10px", fontSize: "var(--gui-text-xl)", fontWeight: 800, color: "var(--gui-ink-strong)" }}>{title}</h2>
    {children}
  </Card>;
  return <Sheet open={open} onClose={onClose ?? (() => {})} title={title} className={className} testId={testId} keys={keys} size={size} tone={tone}>{children}</Sheet>;
}
