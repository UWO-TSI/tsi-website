/**
 * The walk-along tutorial with Bram (specs/v1-drop.md §1.5, approved): learn by doing, minimal, no movement UI. Six steps:
 * the dock (walk with him), the crate on the pier (hop it), the fishing spot (his old rod, the Tab glyph once, a catch),
 * the bag (the B glyph once, open it once), the main street (walk to the front of the museum, the shop, HQ and the café,
 * a line at each), the plaza (the last line and the reward).
 *
 * Stall about 10 s without progress and he says a gentle hint in his speech bubble (again every 20 s while you stay
 * stuck). Progress is the step moving on, getting closer to where it wants you, or a fishing beat (the rod out, a cast).
 * Pure: the world feeds it a frame (where you are, the targets, what happened) and draws the cues it returns.
 */
import { BRAM_LINES, type HintCue } from "./lines";

export type TutorialStepId = "dock" | "crate" | "fish" | "bag" | "museum" | "shop" | "hq" | "cafe" | "plaza";
export const TUTORIAL_ORDER: readonly TutorialStepId[] = ["dock", "crate", "fish", "bag", "museum", "shop", "hq", "cafe", "plaza"];
export type TutorialEvent = "rodHeld" | "cast" | "caught" | "bagOpened";
/** Where the steps want you (world x, z): past the crate, the fishing spot, each building's front, the plaza. */
export type TutorialTargets = Partial<Record<Exclude<TutorialStepId, "dock" | "bag">, { x: number; z: number }>>;

export const HINT_AFTER_S = 10;
export const HINT_AGAIN_S = 20;
/** How far you walk from the boat for the dock step to count as following him. */
const WALKED = 1.2;
/** Reaching a target: the crate's far side is a tight spot on the pier (the crate fills the deck); a front is a step or two. */
const REACH: Partial<Record<TutorialStepId, number>> = { crate: 0.45, plaza: 2.6 };
const FRONT_R = 2.2;
/** Getting this much closer to a target is progress (the stall clock starts again). */
const CLOSER = 0.75;

export type TutorialCue =
  | { kind: "say"; step: TutorialStepId; line: string }
  | HintCue
  | { kind: "glyph"; glyph: "wheel" | "bag" }
  | { kind: "reward" }
  | { kind: "done" };

export interface TutorialState {
  /** Index into TUTORIAL_ORDER. */
  step: number;
  /** Where you stood as it began (the dock step measures the walk from here). */
  start: { x: number; z: number };
  /** The step's start was announced (its line, its glyph): the first frame after it began does it. */
  opened: boolean;
  /** Last progress, last hint (s). */
  progressAt: number; hintAt: number;
  /** The best distance to the step's target so far (or walked, for the dock). */
  best: number;
  /** The rod is out (the fishing step's hint changes). */
  rod: boolean;
  /** Each keycap glyph shows once. */
  glyphs: { wheel: boolean; bag: boolean };
  done: boolean;
}

export const newTutorial = (now: number, start: { x: number; z: number }): TutorialState =>
  ({ step: 0, start: { ...start }, opened: false, progressAt: now, hintAt: -Infinity, best: Infinity, rod: false, glyphs: { wheel: false, bag: false }, done: false });

const STARTS_WITH_LINE: ReadonlySet<TutorialStepId> = new Set(["dock", "fish", "bag"]);

function advance(s: TutorialState, now: number) {
  s.step++;
  s.opened = false;
  s.progressAt = now;
  s.best = Infinity;
}

/** One frame of the tutorial: the cues to draw (lines, a hint, a glyph, the reward, the end), in order. */
export function stepTutorial(s: TutorialState, f: { now: number; player: { x: number; z: number }; targets: TutorialTargets; events: readonly TutorialEvent[] }): TutorialCue[] {
  if (s.done) return [];
  const cues: TutorialCue[] = [];
  const id = () => TUTORIAL_ORDER[s.step];
  // A step's opening: its line and its keycap glyph, once.
  const open = () => {
    if (s.opened) return;
    s.opened = true;
    const step = id(), line = BRAM_LINES[step];
    if (STARTS_WITH_LINE.has(step) && line) cues.push({ kind: "say", step, line });
    if (step === "fish" && !s.glyphs.wheel) { s.glyphs.wheel = true; cues.push({ kind: "glyph", glyph: "wheel" }); }
    if (step === "bag" && !s.glyphs.bag) { s.glyphs.bag = true; cues.push({ kind: "glyph", glyph: "bag" }); }
  };
  open();
  for (const e of f.events) if (e === "rodHeld" || e === "cast") { s.rod = true; s.progressAt = f.now; }
  const step = id();
  let reached = false;
  if (step === "dock") {
    // `best` here is how far you have walked from the boat, as a distance still to go.
    const left = WALKED - Math.hypot(f.player.x - s.start.x, f.player.z - s.start.z);
    if (left < s.best - 0.3) { s.best = left; s.progressAt = f.now; }
    reached = left <= 0;
  } else if (step === "fish") reached = f.events.includes("caught");
  else if (step === "bag") reached = f.events.includes("bagOpened");
  else {
    const t = f.targets[step];
    if (t) {
      const d = Math.hypot(f.player.x - t.x, f.player.z - t.z);
      if (d < s.best - CLOSER) { s.best = d; s.progressAt = f.now; }
      reached = d <= (REACH[step] ?? FRONT_R);
    }
  }
  if (reached) {
    // The street and the plaza: the line is said as you get there.
    const line = BRAM_LINES[step];
    if (!STARTS_WITH_LINE.has(step) && line) cues.push({ kind: "say", step, line });
    if (step === "plaza") {
      cues.push({ kind: "reward" }, { kind: "done" });
      s.done = true;
      return cues;
    }
    advance(s, f.now);
    open();
    return cues;
  }
  // A stall: a gentle hint after a quiet spell, again after a longer one.
  const quiet = Math.max(s.progressAt, s.hintAt), wait = s.hintAt > s.progressAt ? HINT_AGAIN_S : HINT_AFTER_S;
  if (f.now - quiet >= wait) {
    s.hintAt = f.now;
    cues.push({ kind: "hint", step, rod: s.rod });
  }
  return cues;
}
