// Server sanity checks on client-authoritative movement (specs/multiplayer.md §4.5).
// The client stays authoritative over its own avatar; these checks only protect what
// others see. A sample that fails is neither applied nor relayed (others see the
// player stop) and earns a strike that decays 1 per 10 s; 10 strikes is a kick
// (4003), logged only in development. Pure functions over a per-player track.
//
// Time. Samples carry the sender's clock (`t`, ms since the room epoch), which is
// smooth but client-controlled, so every rule is first judged over sender time: a
// step that breaks one is a violation. A sample also can't claim more time than
// really passed: real time (the server's receive clock) accrues as a credit
// between samples and each accepted sample spends its step from it. A step that
// only fails when judged over the credit is a clock running ahead of real time, or
// packets bunched up after a stall past the banked credit: dropped, no strike.
//
// Numbers (honest worst cases measured with the real movement sim through the
// sender's sampling, realtime/test/helpers/traces.ts): horizontal 24.0 u/s (a
// slide at the downhill ceiling), 23.3 u/s averaged over 1 s, rising 14.0 u/s
// (momentum up a ramp), 12.2 u/s (a dash up the grid's 1.5-over-2 ramp), 11.2
// u/s (a mantle at full reach), falling 18.2 u/s (the fall cap), at most 2.0 u
// between samples. §4.5's rising limit of 12 u/s would strike the ramp dash, so
// a climb may also rise at up to `climbGrade` times its horizontal speed (a
// ramp's grade is 0.75), with 15 u/s straight up; falls get the same grade rule.

export type SanityLimits = {
  /** Sender time between samples: under this the sample is dropped (no strike; honest senders keep 30 ms apart). */
  minDtMs: number;
  /** Over this (on both clocks) the sender paused: the next sample starts a fresh baseline. */
  maxDtMs: number;
  /** Instantaneous horizontal speed, u/s. */
  maxHSpeed: number;
  /** Horizontal speed averaged over `avgWindowMs`, u/s. */
  maxHAvg: number;
  avgWindowMs: number;
  /** Straight up, u/s. */
  maxRise: number;
  /** Straight down, u/s (the fall cap is 18). */
  maxFall: number;
  /** A climb or descent may also go at this many units up or down per unit across (ramps are 0.75). */
  climbGrade: number;
  /** Moving more than this within `teleportWindowMs` needs the teleport flag. */
  teleportDist: number;
  teleportWindowMs: number;
  /** Teleport flags honoured: at most one per `teleportGapMs` and `teleportsPerMinute` a minute. Others are checked as plain samples. */
  teleportGapMs: number;
  teleportsPerMinute: number;
  /** Real time banked at a fresh baseline (jitter), and the most that can be banked (packets held by a stall arrive together). */
  initialCreditMs: number;
  maxCreditMs: number;
  strikeDecayMs: number;
  kickStrikes: number;
};

export const SANITY: SanityLimits = {
  minDtMs: 20,
  maxDtMs: 2000,
  maxHSpeed: 32,
  maxHAvg: 26,
  avgWindowMs: 1000,
  maxRise: 15,
  maxFall: 22,
  climbGrade: 0.9,
  teleportDist: 6,
  teleportWindowMs: 300,
  teleportGapMs: 2000,
  teleportsPerMinute: 15,
  initialCreditMs: 300,
  maxCreditMs: 3000,
  strikeDecayMs: 10_000,
  kickStrikes: 10,
};

/** Where an area's positions may be: |x|, |z| ≤ half, y within [yMin, yMax]. */
export type Bounds = { half: number; yMin: number; yMax: number };
export const VILLAGE_BOUNDS: Bounds = { half: 40, yMin: -3, yMax: 25 };
export const INTERIOR_BOUNDS: Bounds = { half: 20, yMin: -3, yMax: 25 };
/** Private areas are never relayed; only the int16 centimetre range applies. */
export const OPEN_BOUNDS: Bounds = { half: 327, yMin: -327, yMax: 327 };

/** A decoded pose: sender time (ms since the room epoch), position in units, the teleport flag. */
export type PoseSample = { t: number; x: number; y: number; z: number; teleport: boolean };

export type Violation = "bounds" | "speed" | "average" | "rise" | "fall" | "teleport";

export type Verdict =
  | { ok: true; reset: boolean }
  /** Not applied, no strike: too soon after the last sample, or a sender clock that stepped back. */
  | { ok: false; drop: true }
  | { ok: false; drop: false; violation: Violation };

export type MotionTrack = {
  base: { t: number; x: number; y: number; z: number } | null;
  /** Server receive time of the last sample of any verdict, for the time credit. */
  lastRecv: number;
  /** Server receive time of the last accepted sample. */
  baseRecv: number;
  credit: number;
  /** Accepted samples in effective time: cumulative ms and horizontal distance, for the window average. */
  hist: { T: number; D: number }[];
  /** Receive times of honoured teleports in the last minute. */
  flags: number[];
  strikes: number;
  strikeAt: number;
};

export function newTrack(): MotionTrack {
  return { base: null, lastRecv: 0, baseRecv: 0, credit: 0, hist: [], flags: [], strikes: 0, strikeAt: 0 };
}

/** The next sample starts fresh: on joining, an area change (a door), a reconnect. */
export function resetBaseline(track: MotionTrack): void {
  track.base = null;
  track.hist.length = 0;
}

export function inBounds(s: { x: number; y: number; z: number }, b: Bounds): boolean {
  return Math.abs(s.x) <= b.half && Math.abs(s.z) <= b.half && s.y >= b.yMin && s.y <= b.yMax;
}

function accept(track: MotionTrack, s: PoseSample, recv: number, elapsed: number, dist: number, reset: boolean, L: SanityLimits): Verdict {
  if (reset) {
    track.hist.length = 0;
    track.hist.push({ T: 0, D: 0 });
    track.credit = L.initialCreditMs;
  } else {
    const last = track.hist[track.hist.length - 1] ?? { T: 0, D: 0 };
    track.hist.push({ T: last.T + elapsed, D: last.D + dist });
    if (track.hist.length > 64) track.hist.shift();
  }
  track.base = { t: s.t, x: s.x, y: s.y, z: s.z };
  track.baseRecv = recv;
  return { ok: true, reset };
}

/**
 * Judge one sample. `recv` is the server's receive time on the same timebase as
 * `t` (ms since the room epoch). Mutates the track only for what it accepts,
 * plus the time credit.
 */
export function checkPose(track: MotionTrack, s: PoseSample, recv: number, bounds: Bounds, L: SanityLimits = SANITY): Verdict {
  if (!inBounds(s, bounds)) return { ok: false, drop: false, violation: "bounds" };

  // Real time since the last sample of any kind accrues as credit.
  if (track.base !== null) track.credit = Math.min(L.maxCreditMs, track.credit + Math.max(0, recv - track.lastRecv));
  track.lastRecv = recv;

  const b = track.base;
  if (b === null) return accept(track, s, recv, 0, 0, true, L);

  const dt = s.t - b.t;
  const realGap = recv - track.baseRecv;
  const dx = s.x - b.x, dy = s.y - b.y, dz = s.z - b.z;
  const h = Math.hypot(dx, dz);

  // A teleport flag within its budget: a door, a seat, a splash respawn. Over budget, it is judged as a plain sample.
  if (s.teleport) {
    while (track.flags.length > 0 && recv - track.flags[0] >= 60_000) track.flags.shift();
    const last = track.flags[track.flags.length - 1];
    if ((last === undefined || recv - last >= L.teleportGapMs) && track.flags.length < L.teleportsPerMinute) {
      track.flags.push(recv);
      return accept(track, s, recv, 0, 0, true, L);
    }
  }

  // A pause on both clocks (a still player, a hidden tab): start over from here.
  if (dt > L.maxDtMs && realGap > L.maxDtMs) return accept(track, s, recv, 0, 0, true, L);
  if (dt < L.minDtMs) {
    // Too soon, or the sender's clock stepped back (a world-clock correction). Recover after a real pause.
    if (realGap > L.maxDtMs) return accept(track, s, recv, 0, 0, true, L);
    return { ok: false, drop: true };
  }

  // Judge the step over the sender's time first: failing that is a violation. Then over the time
  // that really passed (never more than claimed): failing only that is a clock running ahead of real
  // time (or packets bunched past the banked credit), so the sample is dropped without a strike.
  const claimed = judge(track, h, dy, dt, dt, L);
  if (claimed !== null) return { ok: false, drop: false, violation: claimed };
  const elapsed = Math.max(L.minDtMs, Math.min(dt, track.credit));
  if (elapsed < dt && judge(track, h, dy, elapsed, dt, L) !== null) return { ok: false, drop: true };

  track.credit -= elapsed;
  return accept(track, s, recv, elapsed, h, false, L);
}

/** The movement rules for one step of `h` across and `dy` up over `elapsed` ms (sender step `dt`). */
function judge(track: MotionTrack, h: number, dy: number, elapsed: number, dt: number, L: SanityLimits): Violation | null {
  const sec = elapsed / 1000;
  const hs = h / sec;
  if (hs > L.maxHSpeed) return "speed";
  if (dy / sec > Math.max(L.maxRise, L.climbGrade * hs)) return "rise";
  if (-dy / sec > Math.max(L.maxFall, L.climbGrade * hs)) return "fall";
  if (dt <= L.teleportWindowMs && Math.hypot(h, dy) > L.teleportDist) return "teleport";
  // The average from the newest accepted sample at least a window older.
  const last = track.hist[track.hist.length - 1] ?? { T: 0, D: 0 };
  const T = last.T + elapsed, D = last.D + h;
  for (let i = track.hist.length - 1; i >= 0; i--) {
    const e = track.hist[i];
    if (T - e.T >= L.avgWindowMs) return ((D - e.D) / (T - e.T)) * 1000 > L.maxHAvg ? "average" : null;
  }
  return null;
}

/** Records a strike at `recv` after decaying the old ones; returns the count (kick at `kickStrikes`). */
export function addStrike(track: MotionTrack, recv: number, L: SanityLimits = SANITY): number {
  decayStrikes(track, recv, L);
  track.strikes += 1;
  return track.strikes;
}

export function decayStrikes(track: MotionTrack, recv: number, L: SanityLimits = SANITY): number {
  if (track.strikes > 0) track.strikes = Math.max(0, track.strikes - Math.max(0, recv - track.strikeAt) / L.strikeDecayMs);
  track.strikeAt = recv;
  return track.strikes;
}
