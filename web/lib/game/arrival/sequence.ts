/**
 * The arrival (specs/v1-drop.md §1, decided with David 2026-10-13): one continuous sequence after the title screen, once
 * per account. It opens aboard Bram's boat with a short fade in, the world blurred (your memories are gone), then your
 * reflection in the water as the creator (each choice sharpens it, Yes clears it), the golden-hour crossing in five
 * shots, the landing, then the walk-along tutorial with Bram. The underwater opening was removed for v1 (playtest
 * round 1, decision 2): it comes back later, rebuilt from David's assets.
 *
 * Pure: the beats' times, the state machine, the crossing's shot table and how clear the world is. The timed beats
 * skip one press at a time; the creator only moves on at Yes; the crossing's skip is its boat's (lib/game/boatTrip.ts)
 * and the sequence waits for the landing it reports.
 */

export type ArrivalPhase = "aboard" | "creator" | "clearing" | "crossing" | "landing" | "tutorial" | "done";

/** The timed beats (s): `fadeIn` is the black lifting off the boat at the start of `aboard`; `clearing` is the reflection going fully clear after Yes. */
export const ARRIVAL_TIMES = { fadeIn: 1.6, aboard: 4.6, clearing: 1.8 } as const;

export interface Arrival {
  phase: ArrivalPhase;
  /** When the phase began (ms, the caller's clock). */
  at: number;
  /** Choices made in the creator so far: each sharpens the reflection and the world a little. */
  choices: number;
}

/** What moves the untimed beats on: Yes in the creator, the boat at the pier, you ashore, the tutorial done. */
export interface ArrivalSignals { yes?: boolean; landed?: boolean; ashore?: boolean; toured?: boolean }

export const startArrival = (now: number): Arrival => ({ phase: "aboard", at: now, choices: 0 });

const TIMED: Partial<Record<ArrivalPhase, [number, ArrivalPhase]>> = {
  aboard: [ARRIVAL_TIMES.aboard, "creator"],
  clearing: [ARRIVAL_TIMES.clearing, "crossing"],
};
const SIGNALLED: Partial<Record<ArrivalPhase, [keyof ArrivalSignals, ArrivalPhase]>> = {
  creator: ["yes", "clearing"],
  crossing: ["landed", "landing"],
  landing: ["ashore", "tutorial"],
  tutorial: ["toured", "done"],
};

/** Move the arrival on to `now`: each timed beat as its time runs out, the others on their signal. Returns whether it changed. */
export function stepArrival(a: Arrival, now: number, signals: ArrivalSignals): boolean {
  let changed = false;
  for (let guard = 0; guard < 12 && a.phase !== "done"; guard++) {
    const timed = TIMED[a.phase];
    if (timed) {
      const end = a.at + timed[0] * 1000;
      if (now < end) break;
      a.phase = timed[1];
      a.at = end;
      changed = true;
      continue;
    }
    const sig = SIGNALLED[a.phase];
    if (!sig || !signals[sig[0]]) break;
    a.phase = sig[1];
    a.at = now;
    changed = true;
  }
  return changed;
}

/** A press skips the timed beat showing now (never the creator's choice, nor the crossing: its boat skips that). */
export function skipArrival(a: Arrival, now: number): boolean {
  const timed = TIMED[a.phase];
  if (!timed) return false;
  a.phase = timed[1];
  a.at = now;
  return true;
}

// ── The crossing ───────────────────────────────────────────────────────────────────────────────────────────────────
export type CrossingShotId = "drone" | "bow" | "closeup" | "wake" | "wharf";
/** The five shots, in order, each its length (s): about 25 s in all, always golden hour. */
export const CROSSING_SHOTS: readonly { id: CrossingShotId; length: number }[] = [
  { id: "drone", length: 6 },    // wide, high: the island coming out of the veil mist
  { id: "bow", length: 5 },      // low at the bow, the island ahead
  { id: "closeup", length: 4.5 },// you, dripping
  { id: "wake", length: 4.5 },   // the wake behind
  { id: "wharf", length: 5 },    // the wharf coming up
];
export const CROSSING_S = CROSSING_SHOTS.reduce((n, c) => n + c.length, 0);

/** The shot at `t` s into the crossing and how far through it; past the end it holds the last shot's end. */
export function crossingShot(t: number): { index: number; id: CrossingShotId; k: number } {
  let from = 0;
  for (let i = 0; i < CROSSING_SHOTS.length; i++) {
    const c = CROSSING_SHOTS[i];
    if (t < from + c.length) return { index: i, id: c.id, k: Math.max(0, (t - from) / c.length) };
    from += c.length;
  }
  return { index: CROSSING_SHOTS.length - 1, id: "wharf", k: 1 };
}

// ── Memory: how clear the world is ─────────────────────────────────────────────────────────────────────────────────
/** Heavily blurred aboard; each choice a step clearer; never fully clear until Yes. */
export const CLARITY = { start: 0.14, step: 0.075, max: 0.84 } as const;
export const clarityOf = (choices: number) => Math.min(CLARITY.max, CLARITY.start + Math.max(0, choices) * CLARITY.step);
const smooth = (k: number) => { const t = Math.min(1, Math.max(0, k)); return t * t * (3 - 2 * t); };
/** How clear the world and the reflection are at `now`: 0 a blur, 1 sharp. */
export function clarityAt(a: Arrival, now: number): number {
  if (a.phase === "aboard") return CLARITY.start;
  const c = clarityOf(a.choices);
  if (a.phase === "creator") return c;
  if (a.phase === "clearing") return c + (1 - c) * smooth((now - a.at) / (ARRIVAL_TIMES.clearing * 1000 * 0.85));
  return 1;
}
