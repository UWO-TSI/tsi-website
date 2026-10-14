/**
 * The arrival as it runs on this client (components/game/arrival): the sequence (sequence.ts), its signals, the
 * tutorial's state and what the world reported for it. The DOM overlay steps it (it runs while the island's canvas is
 * paused under the creator); the island's canvas reads it each frame for the crossing's shots and Bram's walk. React
 * hears only what changes what it draws (the phase, the tutorial step, a glyph), deferred out of any frame loop.
 */
import { useSyncExternalStore } from "react";
import type { Arrival, ArrivalPhase } from "./sequence";
import type { TutorialEvent, TutorialState } from "./tutorial";

export const arrivalRun = {
  current: null as Arrival | null,
  signals: { yes: false, landed: false, ashore: false, toured: false },
  tutorial: null as TutorialState | null,
  /** What the world reported since the tutorial's last frame (a catch, the bag opened, the rod out). */
  events: [] as TutorialEvent[],
  /** A keycap glyph pulsing once (the wheel, the bag), and when it went up (performance.now ms). */
  glyph: null as { key: "wheel" | "bag"; at: number } | null,
};

/** Report something the tutorial waits for. */
export function arrivalEvent(e: TutorialEvent) {
  if (arrivalRun.current?.phase === "tutorial") arrivalRun.events.push(e);
}

export function resetArrival() {
  arrivalRun.current = null;
  arrivalRun.signals = { yes: false, landed: false, ashore: false, toured: false };
  arrivalRun.tutorial = null;
  arrivalRun.events = [];
  arrivalRun.glyph = null;
  arrivalChanged();
}

const listeners = new Set<() => void>();
let queued = false;
/** Tell React the arrival moved on: deferred out of the frame loop that stepped it. */
export function arrivalChanged() {
  if (queued) return;
  queued = true;
  setTimeout(() => { queued = false; listeners.forEach(l => l()); }, 0);
}
export function subscribeArrival(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
/** What React shows of it: the phase, the tutorial step and the glyph ("" with none). */
export function readArrival(): string {
  const a = arrivalRun.current;
  return a ? `${a.phase}|${arrivalRun.tutorial?.step ?? -1}|${arrivalRun.glyph?.key ?? ""}${arrivalRun.glyph?.at ?? ""}` : "";
}
/** The arrival's phase now, or null when none is running. */
export function useArrivalPhase(): ArrivalPhase | null {
  const key = useSyncExternalStore(subscribeArrival, readArrival, () => "");
  return key ? (key.split("|")[0] as ArrivalPhase) : null;
}
