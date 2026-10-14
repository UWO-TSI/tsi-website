/**
 * The walk-along v2 with Bram (playtest round 1, David's walk-along note): Bram walks to each stop with a "!" over his
 * head and waits. Reaching him moves nothing on: you talk to him (E), he tells you about the place, and then (after the
 * stop's task, if it has one) he walks on to the next stop with the "!" again. The stops are a route per world
 * (routes/): the dock (talk, then hop the crate after him), the museum, the shop, HQ and the café fronts, the beach (he
 * hands you his rod; catch a fish), then what you've collected (B), where fish sell, the museum, the shop.
 *
 * Stall about 10 s without progress and he says a gentle hint in his speech bubble (again every 20 s while you stay
 * stuck). Progress is getting closer to where the stop wants you, or a fishing beat (the rod out, a cast). Pure: the
 * world feeds it a frame (where you are, the resolved route, what happened) and draws the cues it returns.
 */
import { END_LINE, STOP_LINES, TASK_DONE_LINES, TRACKER, TRACKER_TITLE, type HintCue, type HintKind } from "./lines";
import type { ResolvedStop, XZ } from "./route";
import type { TrackedQuest } from "@/lib/game/questTracker";

export type TutorialEvent = "rodHeld" | "cast" | "caught" | "bagOpened" | "talked";
/** At a stop: waiting to be talked to (the "!"), talking, then its task. */
export type TutorialStage = "await" | "talk" | "task";

export const HINT_AFTER_S = 10;
export const HINT_AGAIN_S = 20;
/** Within this of Bram, E talks to him. */
export const TALK_R = 2.4;
/** Getting this much closer to a stop's place is progress (the stall clock starts again). */
const CLOSER = 0.75;
/** A line stays up this long unless E moves it on. */
export const lineSeconds = (line: string) => Math.max(3.2, 1.4 + line.length * 0.05);

export type TutorialCue =
  | { kind: "say"; line: string; stop: string }
  | HintCue
  | { kind: "give"; item: "rod" }
  | { kind: "glyph"; glyph: "wheel" | "bag" }
  | { kind: "reward" }
  | { kind: "done" };

export interface TutorialState {
  /** Index into the route's stops. */
  stop: number;
  stage: TutorialStage;
  /** The talk's line showing, and until when (s). */
  line: number; lineUntil: number;
  /** Last progress, last hint (s), and the best distance to the stop's place so far. */
  progressAt: number; hintAt: number; best: number;
  /** The rod is out (the fishing hint changes). */
  rod: boolean;
  /** What Bram has handed over: the wheel holds only this until the walk is done. */
  given: { rod: boolean };
  /** Each keycap glyph shows once. */
  glyphs: { wheel: boolean; bag: boolean };
  done: boolean;
}

export const newTutorial = (now: number): TutorialState =>
  ({ stop: 0, stage: "await", line: 0, lineUntil: 0, progressAt: now, hintAt: -Infinity, best: Infinity, rod: false, given: { rod: false }, glyphs: { wheel: false, bag: false }, done: false });

export interface TutorialFrame {
  now: number;
  player: XZ;
  /** Where Bram is now. */
  bram: XZ;
  stops: readonly ResolvedStop[];
  events: readonly TutorialEvent[];
}

const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);
function restart(s: TutorialState, now: number) { s.progressAt = now; s.hintAt = -Infinity; s.best = Infinity; }

/** One frame of the walk-along: the cues to draw (lines, a hint, a hand-over, a glyph, the reward, the end), in order. */
export function stepTutorial(s: TutorialState, f: TutorialFrame): TutorialCue[] {
  if (s.done) return [];
  const cues: TutorialCue[] = [];
  const talked = f.events.includes("talked");
  for (const e of f.events) if (e === "rodHeld" || e === "cast") { s.rod = true; s.progressAt = f.now; }
  const stop = f.stops[s.stop];
  if (!stop) { s.done = true; return [{ kind: "reward" }, { kind: "done" }]; }
  const lines = STOP_LINES[stop.id] ?? [];

  // On to the next stop (or the end, with the last word and the reward).
  const next = () => {
    s.stop++; s.stage = "await"; s.line = 0;
    restart(s, f.now);
    if (s.stop >= f.stops.length) {
      cues.push({ kind: "say", line: END_LINE, stop: stop.id }, { kind: "reward" }, { kind: "done" });
      s.done = true;
    }
  };
  // The talk is over: the hand-over, then the task or the next stop.
  const endTalk = () => {
    if (stop.gives === "rod" && !s.given.rod) {
      s.given.rod = true;
      cues.push({ kind: "give", item: "rod" });
      if (!s.glyphs.wheel) { s.glyphs.wheel = true; cues.push({ kind: "glyph", glyph: "wheel" }); }
    }
    // Opening your collection is the task: its keycap pulses once as it starts.
    if (stop.task?.kind === "bag" && !s.glyphs.bag) { s.glyphs.bag = true; cues.push({ kind: "glyph", glyph: "bag" }); }
    if (stop.task) { s.stage = "task"; restart(s, f.now); }
    else next();
  };

  if (s.stage === "await") {
    // You come to him; nothing moves on until you talk.
    if (talked) {
      s.stage = "talk"; s.line = 0;
      if (!lines.length) { endTalk(); return cues; }
      s.lineUntil = f.now + lineSeconds(lines[0]);
      cues.push({ kind: "say", line: lines[0], stop: stop.id });
      return cues;
    }
    const d = dist(f.player, stop.stand);
    if (d < s.best - CLOSER) { s.best = d; s.progressAt = f.now; }
    return hint(s, f, cues, dist(f.player, f.bram) <= TALK_R ? "talk" : "follow");
  }

  if (s.stage === "talk") {
    if (!talked && f.now < s.lineUntil) return cues;
    s.line++;
    if (s.line < lines.length) {
      s.lineUntil = f.now + lineSeconds(lines[s.line]);
      cues.push({ kind: "say", line: lines[s.line], stop: stop.id });
      return cues;
    }
    endTalk();
    return cues;
  }

  // The task.
  const t = stop.task!;
  let reached = false, want: HintKind;
  if (t.kind === "reach") {
    const d = dist(f.player, t.at);
    if (d < s.best - CLOSER * 0.5) { s.best = d; s.progressAt = f.now; }
    reached = d <= t.radius;
    want = t.hint;
  } else if (t.kind === "catch") { reached = f.events.includes("caught"); want = s.rod ? "cast" : "rod"; }
  else { reached = f.events.includes("bagOpened"); want = "bag"; }
  if (reached) {
    const said = TASK_DONE_LINES[t.id];
    if (said) cues.push({ kind: "say", line: said, stop: stop.id });
    next();
    return cues;
  }
  return hint(s, f, cues, want);
}

/** A stall: a gentle hint after a quiet spell, again after a longer one. */
function hint(s: TutorialState, f: TutorialFrame, cues: TutorialCue[], kind: HintKind): TutorialCue[] {
  const quiet = Math.max(s.progressAt, s.hintAt), wait = s.hintAt > s.progressAt ? HINT_AGAIN_S : HINT_AFTER_S;
  if (f.now - quiet >= wait) {
    s.hintAt = f.now;
    cues.push({ kind: "hint", hint: kind });
  }
  return cues;
}

/** Bram is waiting to be talked to: the "!" over his head (and E talks to him once you're near). */
export const awaitsTalk = (s: TutorialState | null) => !!s && !s.done && s.stage === "await";

/** The walk-along as the quest tracker shows it: a step per stop (meet Bram there) and per task, ticking off. */
export function tutorialQuest(stops: readonly ResolvedStop[], s: TutorialState | null, label: (text: string) => string = t => t): TrackedQuest {
  const steps = stops.flatMap((stop, i) => {
    const here = s ? (s.done || i < s.stop ? "past" : i === s.stop ? s.stage : "ahead") : "ahead";
    const talkDone = here === "past" || here === "task";
    const out = [{ id: stop.id, label: label(TRACKER[stop.id] ?? stop.id), done: talkDone }];
    if (stop.task) out.push({ id: stop.task.id, label: label(TRACKER[stop.task.id] ?? stop.task.id), done: here === "past" });
    return out;
  });
  return { id: "arrival-walk", title: TRACKER_TITLE, kind: "tutorial", steps };
}
