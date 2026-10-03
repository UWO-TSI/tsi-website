"use client";

/**
 * The local avatar tap (specs/multiplayer.md §5.2): how the sender finds the player you drive, with nothing per frame in
 * React and nothing at all where no sender runs.
 *
 * `useLocalAvatarTap(motion, held?, sim?)` is one line in each local controller: PlayerAvatar passes its CharacterMotion
 * ref, the tool wheel's item and its movement sim ref; InteriorPlayer (the HQ, museum, Oracle and house) passes only
 * the motion. It registers those refs, and that is all it does: the applicant island and solo play run exactly as
 * before.
 *
 * While a sender exists (`armJournal()` until its disarm), the registered motion gets accessor properties for `play`,
 * `upper`, `ghost` and `stop`: every one-shot written goes into a JOURNAL-slot ring, whoever writes it (PlayerAvatar's
 * events, useWorldClips' Object.assign, combat) and whenever, while the value is still stored for Character to consume.
 * Reading `motion.play` before Character consumes it would depend on useFrame order, which the fishing branch moved
 * (Character at −1). The sim ref's `current` and each MoveSim's `state` get the same treatment, so every 1/120 s step's
 * movement events (a jump, a landing and its drop, a dash, a splash, a respawn…) are journaled at any frame rate.
 * Disarming puts plain data properties back with their current values, even from inside one of the setters.
 */
import { useEffect, type RefObject } from "react";
import type { CharacterMotion } from "@/lib/game/character/clips";
import type { MoveSim, MoveState } from "@/lib/game/movement/sim";
import type { WheelItem } from "@/lib/game/toolWheel";
import { EV } from "./protocol";

/** One registered local controller. `generation` counts registrations: a new one is a scene remount or a respawn. */
export interface LocalAvatar {
  readonly motion: RefObject<CharacterMotion>;
  readonly sim: RefObject<MoveSim | null> | null;
  /** The tool wheel's item in hand (PlayerAvatar's `held`), null for none. */
  held: WheelItem | null;
  readonly generation: number;
  /** MoveSims PlayerAvatar has swapped in while journaled (a leave from a seat, a respawn at the spawn): each is a jump. */
  simSwaps: number;
}

/** Journal slots: one-shots and movement events between two sends. */
export const JOURNAL = 32;
const ONE_SHOTS = ["play", "upper", "ghost", "stop"] as const;
type OneShot = (typeof ONE_SHOTS)[number];

interface TapState {
  stack: LocalAvatar[];
  generation: number;
  /** Senders journaling (armJournal calls not yet disarmed). */
  armed: number;
  /** What carries accessors now. */
  motionObj: CharacterMotion | null;
  simRef: RefObject<MoveSim | null> | null;
  simObj: MoveSim | null;
  // The ring: EV kind, value (a clip name or a length), performance.now() when it happened.
  kind: Int16Array;
  value: (number | string)[];
  at: Float64Array;
  start: number;
  count: number;
  dropped: number;
}
const KEY = "__tsiLocalAvatar";
function tap(): TapState {
  const g = globalThis as unknown as Record<string, TapState | undefined>;
  return (g[KEY] ??= {
    stack: [], generation: 0, armed: 0, motionObj: null, simRef: null, simObj: null,
    kind: new Int16Array(JOURNAL), value: new Array<number | string>(JOURNAL).fill(0), at: new Float64Array(JOURNAL), start: 0, count: 0, dropped: 0,
  });
}
const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Register the local controller (passive: refs only). PlayerAvatar: `useLocalAvatarTap(motion, held, sim)`. */
export function useLocalAvatarTap(motion: RefObject<CharacterMotion>, held?: WheelItem | null, sim?: RefObject<MoveSim | null>): void {
  useEffect(() => {
    const reg = registerLocalAvatar(motion, sim ?? null);
    return () => unregisterLocalAvatar(reg);
  }, [motion, sim]);
  useEffect(() => { setLocalHeld(motion, held ?? null); }, [motion, held]);
}

export function registerLocalAvatar(motion: RefObject<CharacterMotion>, sim: RefObject<MoveSim | null> | null = null): LocalAvatar {
  const s = tap();
  const reg: LocalAvatar = { motion, sim, held: null, generation: ++s.generation, simSwaps: 0 };
  s.stack.push(reg);
  rearm();
  return reg;
}
export function unregisterLocalAvatar(reg: LocalAvatar): void {
  const s = tap(), i = s.stack.indexOf(reg);
  if (i < 0) return;
  s.stack.splice(i, 1);
  rearm();
}
function setLocalHeld(motion: RefObject<CharacterMotion>, held: WheelItem | null) {
  for (const r of tap().stack) if (r.motion === motion) r.held = held;
}

/** The local avatar you drive now: the latest registration still mounted, or null. */
export function localAvatar(): LocalAvatar | null {
  const s = tap();
  return s.stack[s.stack.length - 1] ?? null;
}

// ── The journal ───────────────────────────────────────────────────

function journal(kind: number, value: number | string, at = clock()) {
  const s = tap();
  if (s.count === JOURNAL) { s.start = (s.start + 1) % JOURNAL; s.count--; s.dropped++; }
  const i = (s.start + s.count++) % JOURNAL;
  s.kind[i] = kind; s.value[i] = value; s.at[i] = at;
}
/** The journal's entries, oldest first, handed to `fn` and removed (`at` is performance.now() when it happened). */
export function drainJournal(fn: (kind: number, value: number | string, at: number) => void): void {
  const s = tap();
  while (s.count > 0) {
    const i = s.start;
    s.start = (s.start + 1) % JOURNAL;
    s.count--;
    fn(s.kind[i], s.value[i], s.at[i]);
  }
}
/** Entries waiting, and how many fell off the ring since the last reset (tests, diagnostics). */
export function journalSize(): { count: number; dropped: number } {
  const s = tap();
  return { count: s.count, dropped: s.dropped };
}
export function clearJournal(): void {
  const s = tap();
  s.start = s.count = s.dropped = 0;
}

const ONE_SHOT_KIND: Record<OneShot, number> = { play: EV.play, upper: EV.upper, ghost: EV.ghost, stop: EV.stop };
/** One-shots: a truthy write that isn't the value already waiting (two writes before Character takes it play once). */
function armMotion(m: CharacterMotion) {
  for (const key of ONE_SHOTS) {
    let value = m[key] as unknown;
    Object.defineProperty(m, key, {
      configurable: true, enumerable: true,
      get: () => value,
      set: (v: unknown) => {
        if (v && v !== value) journal(ONE_SHOT_KIND[key], typeof v === "string" ? v : 0);
        value = v;
      },
    });
  }
}
function disarmMotion(m: CharacterMotion) {
  for (const key of ONE_SHOTS) {
    const value = m[key];
    Object.defineProperty(m, key, { configurable: true, enumerable: true, writable: true, value });
  }
}

/** Movement events of each step the sim takes (not `recover`: its clip arrives as a play). */
function journalStep(state: MoveState) {
  const events = state.events;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "recover") continue;
    journal(EV[e.kind], e.kind === "land" || e.kind === "roll" || e.kind === "splash" || e.kind === "mantle" ? e.drop : 0);
  }
}
function armSimState(sim: MoveSim) {
  let state = sim.state;
  Object.defineProperty(sim, "state", {
    configurable: true, enumerable: true,
    get: () => state,
    set: (v: MoveState) => { state = v; journalStep(v); },
  });
}
function disarmSimState(sim: MoveSim) {
  const value = sim.state;
  Object.defineProperty(sim, "state", { configurable: true, enumerable: true, writable: true, value });
}
function armSimRef(ref: RefObject<MoveSim | null>, reg: LocalAvatar) {
  const s = tap();
  let sim = ref.current;
  Object.defineProperty(ref, "current", {
    configurable: true, enumerable: true,
    get: () => sim,
    set: (v: MoveSim | null) => {
      if (v === sim) return;
      if (sim && s.simObj === sim) disarmSimState(sim);
      sim = v;
      s.simObj = v;
      if (v) { armSimState(v); reg.simSwaps++; }
    },
  });
  s.simRef = ref;
  s.simObj = sim;
  if (sim) armSimState(sim);
}
function disarmSimRef(ref: RefObject<MoveSim | null>) {
  const value = ref.current;
  Object.defineProperty(ref, "current", { configurable: true, enumerable: true, writable: true, value });
  if (value) disarmSimState(value);
}

/** Take accessors off whatever carries them, and put them on the current local avatar if a sender is journaling. */
function rearm() {
  const s = tap();
  if (s.motionObj) { disarmMotion(s.motionObj); s.motionObj = null; }
  if (s.simRef) { disarmSimRef(s.simRef); s.simRef = null; s.simObj = null; }
  const reg = localAvatar();
  if (!s.armed || !reg) return;
  const m = reg.motion.current;
  if (m) { armMotion(m); s.motionObj = m; }
  if (reg.sim) armSimRef(reg.sim, reg);
}

/**
 * Start journaling the local avatar's one-shots and movement events (a sender's lifetime). Returns the disarm: plain
 * properties come back with their values once the last sender has gone.
 */
export function armJournal(): () => void {
  const s = tap();
  s.armed++;
  if (s.armed === 1) { clearJournal(); rearm(); }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    s.armed--;
    if (s.armed === 0) { rearm(); clearJournal(); }
  };
}
/** The motion object carrying accessors may have been swapped (a remount): call each frame before reading. */
export function keepArmed(): void {
  const s = tap(), reg = localAvatar();
  if (!s.armed || !reg) return;
  if (reg.motion.current !== s.motionObj || (reg.sim && reg.sim !== s.simRef)) rearm();
}
