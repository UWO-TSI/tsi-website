/**
 * Comfort settings on this device (design sheet §1.6 "Settings", the Settings sheet's Accessibility group): Reduce
 * flashing (default off, on when the OS asks for reduced motion) and Screen shake Full / Low (50%) / Off (default
 * Full, Off when the OS asks for reduced motion: today's rule). Read every frame by the impact code, so cached.
 */
import { useSyncExternalStore } from "react";

export type ShakeLevel = "full" | "low" | "off";
export interface Comfort { reduceFlashing: boolean; screenShake: ShakeLevel }
const KEYS = { reduceFlashing: "tsi.reduceFlashing.v1", screenShake: "tsi.screenShake.v1" } as const;
const EVENT = "tsi:comfort";
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let cached: Comfort | null = null;
export function readComfort(): Comfort {
  if (cached) return cached;
  const calm = reducedMotion();
  let flash: string | null = null, shake: string | null = null;
  try { flash = localStorage.getItem(KEYS.reduceFlashing); shake = localStorage.getItem(KEYS.screenShake); } catch { /* defaults */ }
  return (cached = {
    reduceFlashing: flash === "true" ? true : flash === "false" ? false : calm,
    screenShake: shake === "full" || shake === "low" || shake === "off" ? shake : calm ? "off" : "full",
  });
}
export function setComfort(patch: Partial<Comfort>) {
  const next = { ...readComfort(), ...patch };
  try { localStorage.setItem(KEYS.reduceFlashing, String(next.reduceFlashing)); localStorage.setItem(KEYS.screenShake, next.screenShake); } catch { /* this session only */ }
  cached = next;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}
export const shakeScale = (level: ShakeLevel) => (level === "full" ? 1 : level === "low" ? 0.5 : 0);

const subscribe = (l: () => void) => { window.addEventListener(EVENT, l); return () => window.removeEventListener(EVENT, l); };
const SERVER: Comfort = { reduceFlashing: false, screenShake: "full" };
export const useComfort = () => useSyncExternalStore(subscribe, readComfort, () => SERVER);
