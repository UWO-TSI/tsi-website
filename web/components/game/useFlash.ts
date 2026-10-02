"use client";

import { useEffect, useState } from "react";
import { FLASH_OUT_MS } from "@/lib/game/hudPrefs";

/**
 * A change shown for a moment in the clean HUD (row 283): "in" for `ms` after `value` changes (never on its first
 * value, nor when `when` says the change doesn't count), then "out" while it fades, then null.
 */
export function useFlash(value: unknown, ms: number, when: (prev: unknown, next: unknown) => boolean = () => true): "in" | "out" | null {
  const [seen, setSeen] = useState(value);
  const [change, setChange] = useState(0);
  const [phase, setPhase] = useState<"in" | "out" | null>(null);
  // Adjusting state to a new value during render (react.dev "you might not need an effect"): no extra pass.
  if (!Object.is(seen, value)) {
    setSeen(value);
    if (seen !== null && seen !== undefined && when(seen, value)) { setChange(n => n + 1); setPhase("in"); }
  }
  useEffect(() => {
    if (!change) return;
    const out = window.setTimeout(() => setPhase("out"), ms);
    const gone = window.setTimeout(() => setPhase(null), ms + FLASH_OUT_MS);
    return () => { window.clearTimeout(out); window.clearTimeout(gone); };
  }, [change, ms]);
  return phase;
}
