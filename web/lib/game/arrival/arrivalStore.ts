/**
 * The arrival as it runs on this client (components/game/arrival): the sequence (sequence.ts), its signals, the
 * tutorial's state and what the world reported for it. The DOM overlay steps it (it runs while the island's canvas is
 * paused under the creator); the island's canvas reads it each frame for the crossing's shots and Bram's walk. React
 * hears only what changes what it draws (the phase, the tutorial step, a glyph), deferred out of any frame loop.
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Arrival, ArrivalPhase } from "./sequence";
import { TALK_R, tutorialQuest, type TutorialEvent, type TutorialState } from "./tutorial";
import type { ResolvedStop } from "./route";
import type { ArrivalTools } from "./tools";
import { fillKeys, BRAM } from "./lines";
import type { TrackedQuest } from "@/lib/game/questTracker";
import { hqSnapshot, subscribeHq } from "./hq/store";

export const arrivalRun = {
  current: null as Arrival | null,
  signals: { yes: false, landed: false, ashore: false, toured: false },
  tutorial: null as TutorialState | null,
  /** What the world reported since the tutorial's last frame (a catch, the bag opened, the rod out). */
  events: [] as TutorialEvent[],
  /** A keycap glyph pulsing once (the wheel, the bag), and when it went up (performance.now ms). */
  glyph: null as { key: "wheel" | "bag"; at: number } | null,
  /** The glyph is on screen now (Arrival's chip): the island's own prompt for the same thing stands back (one prompt). */
  chipUp: false,
  /** The walk-along's route in world XZ (the guide resolves it for its world). */
  stops: null as ResolvedStop[] | null,
  /** Where Bram is, and whether E talks to him there (he's at his stop with the "!", or talking): the guide's, each frame. */
  bram: { x: 0, z: 0, talkable: false },
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
  arrivalRun.chipUp = false;
  arrivalRun.stops = null;
  arrivalRun.bram = { x: 0, z: 0, talkable: false };
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
/** What React shows of it: the phase, the walk-along's stop and stage, what Bram has given, the glyph ("" with none). */
export function readArrival(): string {
  const a = arrivalRun.current, t = arrivalRun.tutorial;
  return a ? `${a.phase}|${t ? `${t.stop}:${t.stage}:${t.done ? 1 : 0}` : "-"}|${t?.given.rod ? "rod" : ""}|${arrivalRun.stops?.length ?? 0}|${arrivalRun.glyph?.key ?? ""}${arrivalRun.glyph?.at ?? ""}|${arrivalRun.chipUp ? 1 : 0}` : "";
}
/** The arrival's phase now, or null when none is running. */
export function useArrivalPhase(): ArrivalPhase | null {
  const key = useSyncExternalStore(subscribeArrival, readArrival, () => "");
  return key ? (key.split("|")[0] as ArrivalPhase) : null;
}

/**
 * What the wheel may hold while the arrival runs (lib/game/arrival/tools.ts): null with no arrival (the usual wheel),
 * else only what Bram has handed over.
 */
export function useArrivalTools(): ArrivalTools {
  const key = useSyncExternalStore(subscribeArrival, readArrival, () => "");
  if (!key) return null;
  return { rod: key.split("|")[2] === "rod" };
}

/** The walk-along as the quest tracker shows it (null outside it); `keys` fills the labels' keys. */
export function useTutorialQuest(keys: { bag: string; jump: string; dash: string; touch: boolean }): TrackedQuest | null {
  const key = useSyncExternalStore(subscribeArrival, readArrival, () => "");
  const phase = key.split("|")[0];
  return useMemo(() => {
    if (phase !== "tutorial" || !arrivalRun.stops) return null;
    // In with Alice (HQ first): the tracker is her visit's.
    const t = arrivalRun.tutorial;
    if (t && t.stage === "task" && arrivalRun.stops[t.stop]?.task?.kind === "hq") return null;
    return tutorialQuest(arrivalRun.stops, arrivalRun.tutorial, t => fillKeys(t, keys));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the arrival's snapshot: the quest changes when it does.
  }, [key, phase, keys.bag, keys.jump, keys.dash, keys.touch]);
}

/** The tutorial's chip is up (its glyph): the island's own prompt for the same key hides, so there's one prompt. */
export function useArrivalChip(): boolean {
  return useSyncExternalStore(subscribeArrival, readArrival, () => "").endsWith("|1");
}

/**
 * The tutorial dock (David's v3 review): while you learn on it, it has its dressing (the box to hop, a clear run to dash
 * along); once you've walked into HQ it's cleared for good and the island's own dock shows, after a reload too. Kept
 * on this device, and read from the account too: a visit with Alice under way means you've been in.
 */
const DOCK_KEY = "tsi.dock.cleared";
let dockHere: boolean | null = null;
export function dockCleared(): boolean {
  const v = hqSnapshot().visit;
  if (v && (v.beat > 0 || v.done)) return true;
  if (dockHere === null) { try { dockHere = window.localStorage.getItem(DOCK_KEY) === "1"; } catch { dockHere = false; } }
  return dockHere;
}
/** You've walked into HQ: the dock's dressing goes. */
export function clearDock() {
  if (dockCleared()) return;
  dockHere = true;
  try { window.localStorage.setItem(DOCK_KEY, "1"); } catch { /* this session only; the visit's account copy says so once it's begun */ }
  arrivalChanged();
}
const subscribeDock = (l: () => void) => { const a = subscribeArrival(l), b = subscribeHq(l); return () => { a(); b(); }; };
export const useDockCleared = () => useSyncExternalStore(subscribeDock, dockCleared, () => false);

/** E talks to Bram here: he's waiting at his stop (or talking) and you're within reach. */
export function bramNear(x: number, z: number): boolean {
  const b = arrivalRun.bram;
  return arrivalRun.current?.phase === "tutorial" && b.talkable && Math.hypot(x - b.x, z - b.z) <= TALK_R;
}
/** The prompt's words for E by Bram: talk to him, or (while he talks) on to his next line. */
export const bramPrompt = () => (arrivalRun.tutorial?.stage === "talk" ? "Next" : `Talk to ${BRAM.name}`);
