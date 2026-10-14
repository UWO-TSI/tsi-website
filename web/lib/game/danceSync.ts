/**
 * Group dance sync (specs/v1-drop.md §3): two or more dancers within about 6 steps of each other snap to one shared
 * beat on the world clock, each keeping their own move. Pure, so the frame loop (components/game/dance/DanceSync.tsx)
 * and the tests share it.
 *
 * Every dance is authored on whole bars of 4/4 at 120 BPM (build_clips.py, v1 emotes and dances): one bar is 2 s, a
 * two-bar dance 4 s. A loop locked to the world clock plays the phase `clock mod length`, so any two dancers on any
 * two clients agree on the downbeat, and the wrap of the world clock (86 400 s, a whole number of bars) never jumps.
 * A dancer joining a group eases onto it (`beatRate`) instead of popping.
 */
import { DANCE_CLIPS, type ClipName, type DanceClip } from "./character/clips";

export { DANCE_CLIPS };
/** 120 BPM: the drum loops' tempo too (public/audio/CREDITS.md). */
export const BEAT_S = 0.5;
export const BAR_S = 4 * BEAT_S;
/** The soft beat near any group of dancers: a doumbek's quarter notes, a CC0 loop (public/audio/CREDITS.md). */
export const SOFT_BEAT = { src: "/audio/drums/softbeat.ogg", gain: 0.5 } as const;
/** Dancers this close (world units, a step is about one) belong to one group. */
export const GROUP_RADIUS = 6;
/** How long a dancer takes to settle onto the beat (s). */
export const SETTLE_S = 0.25;
/** The playback rate's range while settling: never stopped, never racing. */
export const RATE_MIN = 0.3, RATE_MAX = 2;

const DANCES: ReadonlySet<string> = new Set(DANCE_CLIPS);
export const isDance = (clip: ClipName | string | null | undefined): clip is DanceClip => !!clip && DANCES.has(clip);

/** A loop's phase (0..1) locked to the shared clock `clock` (s). */
export function loopPhase(clock: number, length: number): number {
  const p = (clock % length) / length;
  return p < 0 ? p + 1 : p;
}

/** How far a loop playing at `time` (s) is behind the locked phase, the short way round the loop (s; + behind). */
export function beatError(time: number, clock: number, length: number): number {
  const e = (((clock - time) % length) + length) % length;
  return e > length / 2 ? e - length : e;
}

/**
 * The playback rate that brings a loop at `time` onto the shared clock over SETTLE_S, for a step of `dt` seconds:
 * after the step the error has shrunk by min(1, dt / SETTLE_S), clamped to RATE_MIN..RATE_MAX. On the beat it is 1.
 */
export function beatRate(time: number, clock: number, length: number, dt: number): number {
  if (!(dt > 0)) return 1;
  const err = beatError(time, clock, length), k = Math.min(1, dt / SETTLE_S);
  return Math.min(RATE_MAX, Math.max(RATE_MIN, 1 + (err * k) / dt));
}

/**
 * Groups of dancers: `out[i]` is dancer i's group (connected within GROUP_RADIUS, chains included), numbered from 0 in
 * order of first member. Returns how many groups. Allocation free: `out` holds at least `n`.
 */
export function danceGroups(xs: ArrayLike<number>, zs: ArrayLike<number>, n: number, out: Int16Array): number {
  for (let i = 0; i < n; i++) out[i] = -1;
  let groups = 0;
  const r2 = GROUP_RADIUS * GROUP_RADIUS;
  for (let i = 0; i < n; i++) {
    if (out[i] >= 0) continue;
    // Flood the new group from i (the list is short: a shard's dancers in view).
    out[i] = groups;
    let grew = true;
    while (grew) {
      grew = false;
      for (let a = 0; a < n; a++) {
        if (out[a] !== groups) continue;
        for (let b = 0; b < n; b++) {
          if (out[b] >= 0) continue;
          const dx = xs[a] - xs[b], dz = zs[a] - zs[b];
          if (dx * dx + dz * dz <= r2) { out[b] = groups; grew = true; }
        }
      }
    }
    groups++;
  }
  return groups;
}
