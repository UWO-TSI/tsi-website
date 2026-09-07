"use client";

import { useEffect, useRef } from "react";

/** Keep keyboard focus and close shortcuts inside an open world dialog. */
export function useWorldDialog(open: boolean, onClose: () => void, closeKey?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = ref.current;
    const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]') ?? []).filter((node) => node.getClientRects().length > 0);
    (controls()[0] ?? panel)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === closeKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) closeRef.current();
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0]; const last = items[items.length - 1];
        if (!first) { event.preventDefault(); panel?.focus(); }
        else if (!panel?.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, closeKey]);
  return ref;
}
