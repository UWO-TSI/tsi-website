"use client";

/**
 * The fishing pass's two flags (specs/polish/fishing.md deliverables 4 and 5; David decides them: specs/polish/
 * fishing-questions.md): the line from the rod's tip to the bobber, and a catch held up in both hands. Both start on
 * and are kept on this device, in Settings beside the other "you on the island" choices (hudPrefs.ts). The line is
 * how this device draws every angler's line; the hold-up is what you do with your own catch (the cast carries it, so
 * others see it the same way).
 */
import { useSyncExternalStore } from "react";

const KEYS = { line: "tsi.fishing.line.v1", holdUp: "tsi.fishing.holdup.v1" } as const;
export type FishingFlag = keyof typeof KEYS;
const cache: Partial<Record<FishingFlag, boolean>> = {};
const listeners = new Set<() => void>();

function read(flag: FishingFlag): boolean {
  if (cache[flag] === undefined) {
    try { cache[flag] = localStorage.getItem(KEYS[flag]) !== "false"; } catch { cache[flag] = true; }
  }
  return cache[flag]!;
}
export function setFishingFlag(flag: FishingFlag, on: boolean) {
  cache[flag] = on;
  try { localStorage.setItem(KEYS[flag], String(on)); } catch { /* this session only */ }
  listeners.forEach(l => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Read in the frame loop (cached): draw the line from the rod to the bobber. */
export const readFishingLine = () => read("line");
/** Read when a catch lands (cached): hold it up in both hands. */
export const readHoldUpCatch = () => read("holdUp");
export const useFishingLine = () => useSyncExternalStore(subscribe, readFishingLine, () => true);
export const useHoldUpCatch = () => useSyncExternalStore(subscribe, readHoldUpCatch, () => true);
