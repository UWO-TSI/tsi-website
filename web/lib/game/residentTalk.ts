/**
 * Talking to residents (specs/polish/reachability.md deliverable 1; row 123): walk up and press E (or click or tap
 * them) and they stop, turn to you and say one of their conversations (lib/content/talk.ts) in the dialogue box, a
 * line at a time, typed out with their voice; then they wave and walk on, their routine picking up where it left off.
 *
 * The parts here are pure (the tests drive them) plus a small store the three pieces share without React state in a
 * frame loop: the residents' frame (components/game/NPC.tsx) writes who is in reach and starts a talk asked for, the
 * dialogue box (components/game/TalkBox.tsx) steps the conversation, and the island (DefaultIslandWorld) reads both
 * for the prompt, the player and the camera.
 *
 * A talk is this viewer's alone, a local presentation (multiplayer-forward, like the greeting bubble and stepping
 * round you): nothing here is sent or shared. Where a resident is comes from their routine on the shared world clock;
 * a talk only holds this viewer's copy of it (its lag, `routineLag`), so on every other screen the same resident keeps
 * walking. How it should look once players can see each other is in specs/polish/reachability-questions.md.
 */
import type { TalkLine } from "@/lib/content/talk";
import type { SFXName } from "./audio";
import { wrapAngle } from "./orbitCamera";
import { hash01 } from "./worldFx";

/** Walk this close and E talks to them. */
export const TALK_RANGE = 1.9;
/** A click or tap on a resident this close talks to them (farther, they wave back). */
export const TALK_CLICK_RANGE = 4.5;
/** They stop and turn to you before the box opens. */
export const TALK_TURN_S = 0.4;
/** The box goes and they wave goodbye before walking on. */
export const TALK_CLOSE_S = 0.6;
/** How fast a resident who fell behind (talked, waited for you) catches up: the routine runs this much faster. */
export const CATCH_UP = 0.35;

// ── Typing ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A character every 26 ms (about 38 a second, a talking pace); a breath after a sentence, a beat after a comma. */
const CHAR_MS = 26, STOP_MS = 260, COMMA_MS = 120;
const pauseAfter = (text: string, i: number) => {
  const next = text[i + 1];
  if (next !== undefined && next !== " " && next !== "\n") return 0;
  const c = text[i];
  return c === "." || c === "!" || c === "?" || c === "…" ? STOP_MS : c === "," || c === ";" || c === ":" ? COMMA_MS : 0;
};
/** How many characters of `text` show `ms` after it started typing. */
export function typedAt(text: string, ms: number): number {
  let t = 0, n = 0;
  for (let i = 0; i < text.length; i++) {
    t += CHAR_MS;
    if (t > ms) break;
    n++;
    t += pauseAfter(text, i);
  }
  return n;
}
/** How long `text` takes to type out (ms). */
export const typeMs = (text: string) => {
  let t = 0;
  for (let i = 0; i < text.length; i++) t += CHAR_MS + (i < text.length - 1 ? pauseAfter(text, i) : 0);
  return t;
};

const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c);
/** The voice: a blip on a word's first letter and every other letter after (syllables, roughly), never on spaces or punctuation. */
export function blipAt(text: string, i: number): boolean {
  if (!isWordChar(text[i])) return false;
  let k = 0;
  while (i - k - 1 >= 0 && isWordChar(text[i - k - 1])) k++;
  return k % 2 === 0;
}
const BLIPS: readonly SFXName[] = ["blip1", "blip2", "blip3", "blip4", "blip5"];
/** A resident's voice: the blips' pitch (their own, from their seed) wobbling a little per letter, and which blip says the letter. */
export function voiceBlip(seed: number, text: string, i: number): { sfx: SFXName; rate: number } {
  const code = text.charCodeAt(i) || 0;
  return { sfx: BLIPS[code % BLIPS.length], rate: (0.84 + hash01(seed, 7) * 0.46) * (0.95 + hash01(code, i) * 0.1) };
}

// ── The conversation ────────────────────────────────────────────────────────────────────────────────────────────────
export interface Talker { id: string; slug: string; name: string; post: string | null; seed: number }
export type TalkPhase = "turning" | "speaking" | "closing" | "ended";
export interface Talk extends Talker {
  lines: readonly TalkLine[];
  index: number;
  phase: TalkPhase;
  /** When the phase began and when the current line started typing (seconds, one clock for the whole talk). */
  since: number;
  lineAt: number;
  /** Characters of the current line showing. */
  typed: number;
}
const HELLO: TalkLine[] = [{ text: "Oh, hello!", face: "happy" }];

export function beginTalk(who: Talker, lines: readonly TalkLine[], now: number): Talk {
  return { ...who, lines: lines.length ? lines : HELLO, index: 0, phase: "turning", since: now, lineAt: now, typed: 0 };
}

export type TalkStep = "turned" | "typing" | "typed" | "ended" | null;
/** Move the talk on to `now` (mutates): the turn ends and the box opens, a line types out, the goodbye finishes. */
export function stepTalk(t: Talk, now: number): TalkStep {
  if (t.phase === "turning") {
    if (now - t.since < TALK_TURN_S) return null;
    t.phase = "speaking"; t.since = now; t.lineAt = now; t.typed = 0;
    return "turned";
  }
  if (t.phase === "closing") {
    if (now - t.since < TALK_CLOSE_S) return null;
    t.phase = "ended";
    return "ended";
  }
  if (t.phase !== "speaking") return null;
  const text = t.lines[t.index].text;
  if (t.typed >= text.length) return null;
  const n = typedAt(text, (now - t.lineAt) * 1000);
  if (n === t.typed) return null;
  t.typed = n;
  return n >= text.length ? "typed" : "typing";
}

export type TalkPress = "finish" | "next" | "close" | null;
/** E, Enter, Space or a click on the box (mutates): finish the line, else the next one, else goodbye. */
export function pressTalk(t: Talk, now: number): TalkPress {
  if (t.phase !== "speaking") return null;
  const text = t.lines[t.index].text;
  if (t.typed < text.length) { t.typed = text.length; return "finish"; }
  if (t.index + 1 < t.lines.length) { t.index++; t.typed = 0; t.lineAt = now; return "next"; }
  t.phase = "closing"; t.since = now;
  return "close";
}
/** Escape: goodbye from anywhere (mutates). */
export function leaveTalk(t: Talk, now: number): void {
  if (t.phase === "closing" || t.phase === "ended") return;
  t.phase = "closing"; t.since = now;
}
/** A line is typing out (their mouth moves). */
export const talkTyping = (t: Talk | null) => !!t && t.phase === "speaking" && t.typed < t.lines[t.index].text.length;

// ── Who's in reach, the routine and the camera ──────────────────────────────────────────────────────────────────────
/** The nearest resident you can see within `range` (index into `list`), or -1. */
export function nearestTalker(list: readonly { x: number; z: number; hidden: boolean }[], px: number, pz: number, range = TALK_RANGE): number {
  let best = -1, bestD = range;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (r.hidden) continue;
    const d = Math.hypot(r.x - px, r.z - pz);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}
/** The routine's lag behind the world clock: held (talking, waiting for you), it grows; let go, it catches up. */
export const routineLag = (lag: number, hold: boolean, dt: number) => (hold ? lag + dt : Math.max(0, lag - CATCH_UP * dt));

/**
 * The camera looks past your shoulder at them: its heading 0.8 to 1.2 radians (46 to 69 degrees) off the line from you
 * to them, so your head never hides their face (a three-quarter view of it). Already there, it stays; looking straight
 * over your head it steps aside;
 * behind you (it would see their back) it comes round the shorter way. As little turning as the view needs.
 */
const SHOULDER_MIN = 0.8, SHOULDER_MAX = 1.2;
/** The camera comes a little lower while you talk (the orbit's pitch, radians): faces, not the tops of heads. */
export const TALK_PITCH = 0.46;
export function talkCameraYaw(px: number, pz: number, rx: number, rz: number, yaw: number): number {
  const a = Math.atan2(rx - px, rz - pz), off = wrapAngle(a - yaw);
  const want = (off < 0 ? -1 : 1) * Math.min(SHOULDER_MAX, Math.max(SHOULDER_MIN, Math.abs(off)));
  return yaw + wrapAngle(a - want - yaw);
}

// ── The store ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface TalkView {
  nearId: string | null; nearName: string;
  activeId: string | null; name: string; post: string | null; slug: string; seed: number;
  phase: TalkPhase | null; index: number; count: number; complete: boolean;
}
const EMPTY: TalkView = { nearId: null, nearName: "", activeId: null, name: "", post: null, slug: "", seed: 0, phase: null, index: 0, count: 0, complete: false };
export const talkStore = {
  /** The resident in reach of E (the residents' frame writes it; `d` every frame, the rest when it changes). */
  near: { id: null as string | null, name: "", d: Infinity },
  /** A talk asked for, by E (the one in reach) or a click or tap; the residents' frame starts it with their lines. */
  request: null as { id: string; click: boolean } | null,
  active: null as Talk | null,
  /** The camera's heading and tilt before the talk turned it, put back after. */
  cameraYaw: null as number | null,
  cameraPitch: null as number | null,
};
const listeners = new Set<() => void>();
let view = EMPTY;
/** Publish what React shows (the prompt's name, the box's speaker, line and phase): only when one of them changed. */
export function talkChanged(): void {
  const n = talkStore.near, a = talkStore.active, phase = a && a.phase !== "ended" ? a.phase : null;
  const next: TalkView = a && phase
    ? { nearId: n.id, nearName: n.name, activeId: a.id, name: a.name, post: a.post, slug: a.slug, seed: a.seed, phase, index: a.index, count: a.lines.length, complete: a.typed >= a.lines[a.index].text.length }
    : { ...EMPTY, nearId: n.id, nearName: n.name };
  if ((Object.keys(next) as (keyof TalkView)[]).every(k => next[k] === view[k])) return;
  view = next;
  listeners.forEach(l => l());
}
export const talkView = () => view;
export const emptyTalkView = () => EMPTY;
export function subscribeTalk(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function setTalkNear(id: string | null, name: string, d: number): void {
  const n = talkStore.near;
  n.d = d;
  if (n.id === id) return;
  n.id = id; n.name = name;
  talkChanged();
}
export function requestTalk(id: string | null, click = false): void { if (id && !talkStore.active) talkStore.request = { id, click }; }
export function startTalk(t: Talk): void { talkStore.active = t; talkStore.request = null; talkChanged(); }
export function endTalk(): void { talkStore.active = null; talkStore.request = null; talkChanged(); }
