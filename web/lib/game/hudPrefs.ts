"use client";

/**
 * The minimal HUD (David, 2026-10-02, row 283; playtest round 1, decision 3): while you play the screen keeps to the
 * quest tracker, the minimap and the time (and the prompt, toasts, the held item's use and the "click to look" hint);
 * coins and XP slide in when they change, then fade. The fuller HUD (coins and level, the gear, the menu dock, the
 * chat log, a bigger minimap) is the UI view: Esc 1 (lib/game/escMenu.ts), or the menu button on a touch screen. The
 * coins and level also show while the HUD key is held, or always with "Keep coins and level on screen". Kept on this
 * device.
 */
import { useSyncExternalStore } from "react";

/**
 * The fuller HUD or the minimal one, from the UI view, the HUD key and the setting. A cinematic moment (talking to a
 * resident, the HQ lead's greeting, the boat trip; world audit item 7) stands the HUD back, leaving the dialogue or the
 * trip's Skip.
 */
export function fullHud(s: { always: boolean; keyHeld: boolean; uiView: boolean; cinematic?: boolean }): boolean {
  return !s.cinematic && (s.always || s.keyHeld || s.uiView);
}

/**
 * A phone's HUD (world audit item 11): a touch screen has no Esc, so one menu button top left opens the UI view, and the
 * place name and the touch hint flash as a scene comes in. "Keep coins and level on screen" leaves the hint up.
 */
export const compactTouchHud = (s: { touch: boolean; always: boolean }): boolean => s.touch && !s.always;

/** How long a change shows in the clean HUD (ms), and the fade after it. */
export const FLASH_MS = { coins: 2000, clock: 4500, mail: 5000, objective: 6000, heading: 3500 } as const;
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
