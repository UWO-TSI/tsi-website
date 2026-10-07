"use client";

/**
 * The minimal HUD (David, 2026-10-02, row 283): while exploring the screen is clean (the prompt, toasts, the held
 * item's use and the "click to look" hint); coins, XP, the clock and mail slide in when they change, then fade; the
 * full HUD shows while its key is held, in the pause view (the mouse let go: Esc, a sheet, the right-click cursor,
 * the cursor setting), on a touch screen, or always with "Show full HUD". Kept on this device.
 */
import { useSyncExternalStore } from "react";
import type { CaptureState } from "./orbitCamera";

/**
 * The full HUD or the clean one, from the setting, the HUD key, the device and the mouse capture. A cinematic moment
 * (talking to a resident, the HQ lead's greeting, the boat trip; world audit item 7) lets the cursor go but is not the
 * pause view: the HUD stands back for it, leaving the dialogue or the trip's Skip.
 */
export function fullHud(s: { always: boolean; keyHeld: boolean; touch: boolean; capture: CaptureState; cinematic?: boolean }): boolean {
  return !s.cinematic && (s.always || s.keyHeld || s.touch || s.capture !== "captured");
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

// ── Classes v2 (design sheet §1.9): the class on your nameplate ──
const CLASS_KEY = "tsi.nameplate.class.v1";
let showClass: boolean | null = null;
const readShowClass = () => {
  if (showClass === null) { try { showClass = localStorage.getItem(CLASS_KEY) !== "false"; } catch { showClass = true; } }
  return showClass;
};
/** "Show class on my nameplate" (default on). ponytail: kept on this device; it hides it for everyone once other players see nameplates (multiplayer). */
export function setShowClass(on: boolean) {
  showClass = on;
  try { localStorage.setItem(CLASS_KEY, String(on)); } catch { /* this session only */ }
  listeners.forEach(l => l());
}
export const useShowClass = () => useSyncExternalStore(subscribe, readShowClass, () => true);

/** The player's class on the nameplate: the class icon, the mastery title and the equipped frame (set from progression). */
export interface ClassTag { icon: string; title: string; frame: "bronze" | "silver" | "gold" | null; color: string }
let tag: ClassTag | null = null;
export function setClassTag(next: ClassTag | null) { tag = next; listeners.forEach(l => l()); }
export const useClassTag = () => useSyncExternalStore(subscribe, () => tag, () => null);
