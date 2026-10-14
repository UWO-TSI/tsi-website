/**
 * The emote wheel (specs/v1-drop.md §3): what its two rings hold, and its input as a pure state machine the overlay
 * (components/game/emotes/EmoteWheel.tsx) and the tests share.
 *
 * - Hold the emote key (G, rebindable): after TAP_MS the ring opens; point at a petal and let go to play it.
 * - A quick tap plays the last emote again; with nothing to repeat it opens the ring for a click (as a phone's button does).
 * - The centre flips the ring between the emotes and the eight dances; the ring you used last is the one that opens.
 * - Letting go over the centre or nothing, or Esc, plays nothing.
 *
 * Sit and Sleep are held poses (`held`): the world puts you on the ground for them (a ring seat at the campfire), where
 * the rest are one-shots, and every dance is a loop that holds until you move.
 */
import type { ClipName } from "./character/clips";

export interface WheelEntry {
  id: string;
  name: string;
  clip: ClipName;
  /** A held pose on the ground (tsi:sit-here) rather than a one-shot. */
  held?: boolean;
}
export const EMOTE_RING: readonly WheelEntry[] = [
  { id: "wave", name: "Wave", clip: "Wave" },
  { id: "cheer", name: "Cheer", clip: "Cheer" },
  { id: "clap", name: "Clap", clip: "Clap" },
  { id: "laugh", name: "Laugh", clip: "Laugh" },
  { id: "sit", name: "Sit", clip: "SitGround", held: true },
  { id: "sleep", name: "Sleep", clip: "Sleep", held: true },
  { id: "bow", name: "Bow", clip: "Bow" },
  { id: "shrug", name: "Shrug", clip: "Shrug" },
];
export const DANCE_RING: readonly WheelEntry[] = [
  { id: "bounce", name: "Happy bounce", clip: "DanceBounce" },
  { id: "spin", name: "Little spin", clip: "DanceSpin" },
  { id: "shuffle", name: "Shuffle", clip: "DanceShuffle" },
  { id: "sway", name: "Sway", clip: "DanceSway" },
  { id: "wiggle", name: "Wiggle", clip: "DanceWiggle" },
  { id: "flail", name: "Goofy flail", clip: "DanceFlail" },
  { id: "robot", name: "Robot", clip: "DanceRobot" },
  { id: "sprinkler", name: "Sprinkler", clip: "DanceSprinkler" },
];

/** A press shorter than this is the quick tap (the tool wheel's beat, ToolWheel TAP_MS). */
export const TAP_MS = 170;
export type Ring = "emotes" | "dances";
export interface WheelState {
  /** Closed, held open by the key, or open for a click (a tap with nothing to repeat, or the phone's button). */
  open: false | "hold" | "click";
  /** When the key went down (ms). */
  at: number;
  ring: Ring;
  /** The petal pointed at, or null (the centre, or nothing yet). */
  choice: number | null;
  /** The last thing played: what a tap repeats. */
  last: WheelEntry | null;
}
export type WheelAct = { kind: "none" } | { kind: "play"; entry: WheelEntry };
const NONE: WheelAct = { kind: "none" };

export const createWheel = (): WheelState => ({ open: false, at: 0, ring: "emotes", choice: null, last: null });
export const ringOf = (s: Pick<WheelState, "ring">): readonly WheelEntry[] => (s.ring === "dances" ? DANCE_RING : EMOTE_RING);
const ringFor = (e: WheelEntry): Ring => (DANCE_RING.includes(e) ? "dances" : "emotes");

/** The key went down: held open, on the ring you used last. Already open for a click, the key closes it. */
export function pressWheel(s: WheelState, now: number): WheelState {
  if (s.open === "click") return closeWheel(s);
  if (s.open) return s;
  return { ...s, open: "hold", at: now, choice: null, ring: s.last ? ringFor(s.last) : s.ring };
}
/** Open for a click (the phone's emote button). */
export const openForClick = (s: WheelState): WheelState => ({ ...s, open: "click", choice: null, ring: s.last ? ringFor(s.last) : s.ring });
/** The ring shows once the key has been held past the tap. */
export const holdShown = (s: WheelState, now: number) => s.open === "click" || (s.open === "hold" && now - s.at >= TAP_MS);
/** Point at a petal (or null, the centre). Outside the ring is nothing. */
export function pickAt(s: WheelState, i: number | null): WheelState {
  const ok = i !== null && Number.isInteger(i) && i >= 0 && i < ringOf(s).length;
  return { ...s, choice: ok ? i : null };
}
/** The centre: the other ring. */
export const flipRing = (s: WheelState): WheelState => ({ ...s, ring: s.ring === "emotes" ? "dances" : "emotes", choice: null });
export const closeWheel = (s: WheelState): WheelState => ({ ...s, open: false, choice: null });

/** Play what's chosen now (a click on a petal, or a release over one). */
export function playChoice(s: WheelState): { state: WheelState; act: WheelAct } {
  const entry = s.choice !== null ? ringOf(s)[s.choice] : null;
  if (!entry) return { state: closeWheel(s), act: NONE };
  return { state: { ...closeWheel(s), last: entry, ring: ringFor(entry) }, act: { kind: "play", entry } };
}

/** The key came up. */
export function releaseWheel(s: WheelState, now: number): { state: WheelState; act: WheelAct } {
  if (s.open !== "hold") return { state: s, act: NONE };
  const tapped = now - s.at < TAP_MS && s.choice === null;
  if (tapped) return s.last ? { state: closeWheel(s), act: { kind: "play", entry: s.last } } : { state: { ...s, open: "click" }, act: NONE };
  return playChoice(s);
}
