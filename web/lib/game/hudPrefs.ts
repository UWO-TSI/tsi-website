"use client";

/**
 * The minimal HUD (David, 2026-10-02, row 283): while exploring the screen is clean (the prompt, toasts, the held
 * item's use and the "click to look" hint); coins, XP, the clock and mail slide in when they change, then fade; the
 * full HUD shows while its key is held, in the pause view (the mouse let go: Esc, a sheet, the right-click cursor,
 * the cursor setting), on a touch screen, or always with "Show full HUD". Kept on this device.
 */
import { useSyncExternalStore } from "react";
import type { CaptureState } from "./orbitCamera";

/** The full HUD or the clean one, from the setting, the HUD key, the device and the mouse capture. */
export function fullHud(s: { always: boolean; keyHeld: boolean; touch: boolean; capture: CaptureState }): boolean {
  return s.always || s.keyHeld || s.touch || s.capture !== "captured";
}

/** How long a change shows in the clean HUD (ms), and the fade after it. */
export const FLASH_MS = { coins: 3200, xp: 3200, clock: 4500, mail: 5000, objective: 6000, heading: 3500 } as const;
export const FLASH_OUT_MS = 320;

const KEY = "tsi.hud.full.v1";
const listeners = new Set<() => void>();
let always: boolean | null = null;
const read = () => {
  if (always === null) { try { always = localStorage.getItem(KEY) === "true"; } catch { always = false; } }
  return always;
};
export function setAlwaysFullHud(on: boolean) {
  always = on;
  try { localStorage.setItem(KEY, String(on)); } catch { /* this session only */ }
  listeners.forEach(l => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useAlwaysFullHud = () => useSyncExternalStore(subscribe, read, () => false);
