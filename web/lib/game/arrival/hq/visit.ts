/**
 * The HQ visit's state (row 312): which beat of script.ts you're on and whether Alice is saying its lines or it's
 * waiting for you. Pure: the island feeds it events (her lines said, the desk, the register signed, Esc, the map, the
 * board) and acts on what `visitCue` asks for (say these lines, open this card). Kept on this device between visits
 * (store.ts), so a reload picks up at the beat you were on (her lines again, then the wait).
 */
import { HQ_END, HQ_SCRIPT, type HqBeat, type HqCard, type HqEvent } from "./script";
import { HQ_TITLE, HQ_TRACKER } from "./lines";
import type { TrackedQuest } from "@/lib/game/questTracker";

export interface HqState {
  /** Index into the script; the script's length is the farewell. */
  beat: number;
  /** Alice is to say the beat's lines (or the farewell), or the beat waits for you. */
  stage: "say" | "wait";
  done: boolean;
}

/** A beat's opening stage: her lines first if it has any. */
const opening = (beat: number, script: readonly HqBeat[]): HqState["stage"] => (beat >= script.length || script[beat].say?.length ? "say" : "wait");
export const newVisit = (script: readonly HqBeat[] = HQ_SCRIPT): HqState => ({ beat: 0, stage: opening(0, script), done: false });

export type HqCue = { kind: "say"; keys: readonly string[] } | { kind: "card"; card: HqCard };
/** What the visit wants now: her lines said, or a card open (null: nothing, it's waiting on you, or it's over). */
export function visitCue(s: HqState, script: readonly HqBeat[] = HQ_SCRIPT): HqCue | null {
  if (s.done) return null;
  if (s.stage === "say") return { kind: "say", keys: s.beat >= script.length ? HQ_END : script[s.beat].say ?? [] };
  const card = script[s.beat]?.card;
  return card ? { kind: "card", card } : null;
}

/** What moves it: her lines said ("said"), or what a beat waits for. Anything else changes nothing. A new state. */
export function visitEvent(s: HqState, e: HqEvent | "said", script: readonly HqBeat[] = HQ_SCRIPT): HqState {
  if (s.done) return s;
  if (s.stage === "say") {
    if (e !== "said") return s;
    return s.beat >= script.length ? { ...s, done: true } : { ...s, stage: "wait" };
  }
  if (e !== script[s.beat]?.wait) return s;
  const beat = s.beat + 1;
  return { beat, stage: opening(beat, script), done: false };
}

/** The beat waiting on you now (null while she talks or once it's over): the island listens for its event. */
export const waitingFor = (s: HqState | null, script: readonly HqBeat[] = HQ_SCRIPT): HqEvent | null =>
  s && !s.done && s.stage === "wait" ? script[s.beat]?.wait ?? null : null;

/** The visit as the quest tracker shows it: a step per beat, ticked as you pass it. `label` fills the keys. */
export function hqQuest(s: HqState, label: (text: string) => string = t => t, script: readonly HqBeat[] = HQ_SCRIPT): TrackedQuest {
  return {
    id: "hq-visit", title: HQ_TITLE, kind: "tutorial",
    steps: script.map((b, i) => ({ id: b.id, label: label(HQ_TRACKER[b.id] ?? b.id), done: s.done || i < s.beat })),
  };
}

/** A saved visit read back (store.ts): anything that isn't one is no visit. */
export function parseVisit(raw: unknown, script: readonly HqBeat[] = HQ_SCRIPT): HqState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<HqState>;
  if (typeof r.beat !== "number" || !Number.isInteger(r.beat) || r.beat < 0 || r.beat > script.length) return null;
  if (r.done === true) return { beat: script.length, stage: "say", done: true };
  // A reload mid-beat starts the beat again: her lines, then the wait.
  return { beat: r.beat, stage: opening(r.beat, script), done: false };
}
