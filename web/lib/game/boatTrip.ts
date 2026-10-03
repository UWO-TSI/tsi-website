/**
 * The boat trip between the village and your island (specs/polish/arrival-wharf.md deliverable 3; row 211 for a first
 * login): you walk down the pier and step aboard, the lines come off, the boat backs out, swings round and motors out
 * to sea; a veil comes up while the other island loads; then the boat comes in to that pier, docks, and you step ashore
 * and walk up it. A press skips the rest under a quick veil.
 *
 * A trip belongs to the avatar making it (multiplayer-forward): it is plain data (who, where from and to, the phase,
 * the world time it began, where they stood, a skip) and the boat's course, its wake and the rider are functions of it
 * and the world clock (lib/game/worldClock.ts worldNow, epoch ms). The traveller's own client steps it (`stepTrip`:
 * a phase's time runs out, the next island has loaded, a press skips); anyone else shown it draws the same boat at the
 * same moment. Everything is in the dock's frame (lib/game/wharf.ts): the boarding dock while leaving, the arrival
 * dock from the load on.
 */
import { ASHORE, MOORED, STEP_AT, mooredPose, type BoatPose } from "./wharf";

export { newBoatPose, type BoatPose } from "./wharf";

export type TripPlace = "village" | "home";
export type TripPhase = "board" | "castoff" | "turn" | "sail" | "veil" | "load" | "arrive" | "dock" | "land" | "reveal" | "done";

export interface BoatTrip {
  /** Whose trip: the travelling avatar ("me" for this player; a session id once others are shown). */
  who: string;
  from: TripPlace | "sea";
  to: TripPlace;
  /** "out" while leaving `from`, "in" from the load on (and from the start of a first login's arrival). */
  leg: "out" | "in";
  phase: TripPhase;
  /** World ms the phase began. */
  at: number;
  /** Where the traveller stood when they asked for the boat (the boarding dock's frame) and which way they faced; null: at the step. */
  start: { x: number; z: number; yaw: number } | null;
  /** A press to skip: the phase it came in and how far into it (s). The quick veil plays on from there. */
  skip: { phase: TripPhase; t: number } | null;
}

/** Times (s) and paces of the trip. */
export const TRIP = {
  /** The stroll along the pier, to the boat and from it (u/s). */
  stroll: 5.5,
  /** Turning to face the boat before stepping aboard. */
  face: 0.18,
  /** The step over the gunwale, aboard or ashore, and how high it goes. */
  hop: 0.5, hopHeight: 0.45,
  /** Sitting down on the bench (the boat dips under you), and standing up again. */
  settle: 0.55, rise: 0.35,
  /** Turning inland at the top of the pier. */
  stand: 0.2,
  castoff: 1.5,
  sail: 3.0,
  veil: 0.7, quickVeil: 0.3,
  /** The least time under the veil, so even an island that is already there gets a beat. */
  minLoad: 0.25,
  /** The veil lifting as the boat comes in. */
  lift: 0.7,
  dock: 1.3,
  reveal: 0.45,
} as const;

// ── The boat's course (the dock's frame) ───────────────────────────────────────────────────────────────────────────
/** Where it stops backing out, and its heading then. */
const CAST = { x: 2.85, z: -3.62, yaw: 0.35 };
/** The swing round: the bow comes round through +x, away from the pier, on this radius, by this much. */
const SWING_R = 1.35, SWING_BY = 2.55;
/** Speeds (u/s): out of the swing, out at sea; coming in from the sea, alongside the tip. */
const V_SWUNG = 2.6, V_SEA = 7, V_IN = 6, V_ALONGSIDE = 0.7;
/** The approach: from out at sea to just off the berth. */
const IN_FROM = { x: 5.6, z: -15.5, yaw: -0.14 }, IN_TO = { x: 2.62, z: -3.32, yaw: -0.06 };
/** How far into the dock the hull meets the fenders (the bump). */
const BUMP_AT = 0.72;

const fwdX = Math.sin, fwdZ = Math.cos;
const SWING_C = { x: CAST.x + SWING_R * Math.cos(CAST.yaw), z: CAST.z - SWING_R * Math.sin(CAST.yaw) };
const SWING_LEN = SWING_R * SWING_BY, SWING_T = (2 * SWING_LEN) / V_SWUNG;
const OUT_YAW = CAST.yaw + SWING_BY;
const SWUNG = { x: SWING_C.x - SWING_R * Math.cos(OUT_YAW), z: SWING_C.z + SWING_R * Math.sin(OUT_YAW) };
const SAIL_LEN = ((V_SWUNG + V_SEA) / 2) * TRIP.sail;
// The approach as a cubic Bézier, walked by arc length (a table of it, made once).
const IN_SPAN = Math.hypot(IN_TO.x - IN_FROM.x, IN_TO.z - IN_FROM.z) / 3;
const BEZ = [IN_FROM.x, IN_FROM.z, IN_FROM.x + fwdX(IN_FROM.yaw) * IN_SPAN, IN_FROM.z + fwdZ(IN_FROM.yaw) * IN_SPAN,
  IN_TO.x - fwdX(IN_TO.yaw) * IN_SPAN, IN_TO.z - fwdZ(IN_TO.yaw) * IN_SPAN, IN_TO.x, IN_TO.z];
const bez = (u: number, k: number) => { const v = 1 - u; return v * v * v * BEZ[k] + 3 * v * v * u * BEZ[k + 2] + 3 * v * u * u * BEZ[k + 4] + u * u * u * BEZ[k + 6]; };
const bezD = (u: number, k: number) => { const v = 1 - u; return 3 * v * v * (BEZ[k + 2] - BEZ[k]) + 6 * v * u * (BEZ[k + 4] - BEZ[k + 2]) + 3 * u * u * (BEZ[k + 6] - BEZ[k + 4]); };
const ARC_N = 96, ARC = new Float64Array(ARC_N + 1);
for (let i = 1; i <= ARC_N; i++) ARC[i] = ARC[i - 1] + Math.hypot(bez(i / ARC_N, 0) - bez((i - 1) / ARC_N, 0), bez(i / ARC_N, 1) - bez((i - 1) / ARC_N, 1));
const IN_LEN = ARC[ARC_N], ARRIVE_T = (2 * IN_LEN) / (V_IN + V_ALONGSIDE);
/** The Bézier's parameter at arc length s. */
function arcU(s: number): number {
  if (s <= 0) return 0;
  if (s >= IN_LEN) return 1;
  let lo = 0, hi = ARC_N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ARC[m] < s) lo = m; else hi = m; }
  return (lo + (s - ARC[lo]) / (ARC[hi] - ARC[lo])) / ARC_N;
}

// ── The rider's timeline ───────────────────────────────────────────────────────────────────────────────────────────
const stepAt = (start: BoatTrip["start"]) => start ?? { x: STEP_AT.x, z: STEP_AT.z, yaw: Math.PI / 2 };
const strollTime = (d: number) => (d > 0.05 ? d / TRIP.stroll + 0.25 : 0);
/** Boarding: the stroll to the step, facing the boat, the step aboard, sitting down. */
function boardTimes(start: BoatTrip["start"]) {
  const s = stepAt(start), walk = strollTime(Math.hypot(STEP_AT.x - s.x, STEP_AT.z - s.z));
  return { walk, face: walk + TRIP.face, hop: walk + TRIP.face + TRIP.hop, total: walk + TRIP.face + TRIP.hop + TRIP.settle };
}
const LAND_WALK = strollTime(Math.hypot(ASHORE.x - STEP_AT.x, ASHORE.z - STEP_AT.z));
const LAND = { rise: TRIP.rise, hop: TRIP.rise + TRIP.hop, walk: TRIP.rise + TRIP.hop + LAND_WALK, total: TRIP.rise + TRIP.hop + LAND_WALK + TRIP.stand };

// ── Steps ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Ask for the boat at `from`'s pier: the trip starts with the walk to it. `start`: where you stand, in that dock's frame. */
export function startTrip(who: string, from: TripPlace, to: TripPlace, start: BoatTrip["start"], now: number): BoatTrip {
  return { who, from, to, leg: "out", phase: "board", at: now, start, skip: null };
}
/** A first login's arrival (row 211): from out at sea to `to`'s pier. With the island already showing, a veil comes up first; under the loading screen it waits there. */
export function arrivalTrip(who: string, to: TripPlace, now: number, showing: boolean): BoatTrip {
  return { who, from: "sea", to, leg: "in", phase: showing ? "veil" : "load", at: now, start: null, skip: null };
}

/** How long the trip's current phase runs (s); the load waits for the island, and done is the end. */
export function phaseLength(trip: BoatTrip): number {
  switch (trip.phase) {
    case "board": return boardTimes(trip.start).total;
    case "castoff": return TRIP.castoff;
    case "turn": return SWING_T;
    case "sail": return TRIP.sail;
    case "veil": return quick(trip) ? TRIP.quickVeil : TRIP.veil;
    case "arrive": return ARRIVE_T;
    case "dock": return TRIP.dock;
    case "land": return LAND.total;
    case "reveal": return TRIP.reveal;
    default: return Infinity;
  }
}
/** The veil came up because of a press (not one that came during the veil or the load). */
const quick = (trip: BoatTrip) => !!trip.skip && trip.skip.phase !== "veil" && trip.skip.phase !== "load";

const NEXT: Partial<Record<TripPhase, TripPhase>> = { board: "castoff", castoff: "turn", turn: "sail", sail: "veil", veil: "load", arrive: "dock", dock: "land", land: "done", reveal: "done" };
/**
 * Move the traveller's trip on to `now` (world ms): each phase in turn as its time runs out; the load waits until the
 * next island has `loaded` (and a beat). Returns whether the phase changed. Only the traveller's own client calls this.
 */
export function stepTrip(trip: BoatTrip, now: number, loaded: boolean): boolean {
  let changed = false;
  for (let guard = 0; guard < 16 && trip.phase !== "done"; guard++) {
    if (trip.phase === "load") {
      if (!loaded || now - trip.at < TRIP.minLoad * 1000) break;
      trip.phase = trip.skip ? "reveal" : "arrive";
      trip.at = now;
      changed = true;
      continue;
    }
    const len = phaseLength(trip) * 1000;
    if (now - trip.at < len) break;
    trip.at += len;
    trip.phase = NEXT[trip.phase]!;
    if (trip.phase === "load") trip.leg = "in";
    changed = true;
  }
  return changed;
}

/** A press to skip: the rest goes by under a quick veil and you are on the pier. Returns whether it did anything. */
export function skipTrip(trip: BoatTrip, now: number): boolean {
  if (trip.skip || trip.phase === "reveal" || trip.phase === "done") return false;
  trip.skip = { phase: trip.phase, t: Math.max(0, (now - trip.at) / 1000) };
  if (trip.phase !== "veil" && trip.phase !== "load") { trip.phase = "veil"; trip.at = now; }
  return true;
}

/** Which island's scene shows the trip now. */
export const tripScene = (trip: BoatTrip): TripPlace => (trip.leg === "in" || trip.from === "sea" ? trip.to : trip.from);
/** Whether the trip's boat has `place`'s berth (the moored boat there gives way to it). */
export function berthTaken(trip: BoatTrip | null, place: TripPlace): boolean {
  if (!trip || trip.phase === "done") return false;
  return trip.leg === "out" ? trip.from === place : trip.to === place;
}
/** Seconds into the current phase. */
const since = (trip: BoatTrip, now: number) => Math.max(0, (now - trip.at) / 1000);
/** Under a quick veil the boat and the rider play on from the moment of the press: the phase and time to draw. */
function drawn(trip: BoatTrip, now: number): [TripPhase, number] {
  if (trip.phase === "veil" && trip.skip && quick(trip)) {
    const t = trip.skip.t + since(trip, now), phase = trip.skip.phase;
    return [phase, Math.min(t, phaseLength({ ...trip, phase, skip: null }))];
  }
  return [trip.phase, since(trip, now)];
}

// ── The boat ───────────────────────────────────────────────────────────────────────────────────────────────────────
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const smoother = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * k * (k * (k * 6 - 15) + 10); };
const smootherD = (t: number) => (t <= 0 || t >= 1 ? 0 : 30 * t * t * (t - 1) * (t - 1));
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Where the boat is at `now` (world ms) in the dock's frame of the scene showing the trip. */
export function boatPose(trip: BoatTrip, now: number, out: BoatPose): BoatPose {
  mooredPose(out);
  const [phase, t] = drawn(trip, now);
  switch (phase) {
    case "board": {
      const b = boardTimes(trip.start);
      out.dip = t >= b.hop ? t - b.hop : -1;
      return out;
    }
    case "castoff": {
      const k = t / TRIP.castoff, m = (k - 0.25) / 0.75, y = (k - 0.35) / 0.65;
      out.lines = 1 - smooth(0, 0.35, k);
      out.x = MOORED.x + (CAST.x - MOORED.x) * smoother(m);
      out.z = MOORED.z + (CAST.z - MOORED.z) * smoother(m);
      out.yaw = MOORED.yaw + (CAST.yaw - MOORED.yaw) * smoother(y);
      out.speed = (Math.hypot(CAST.x - MOORED.x, CAST.z - MOORED.z) * smootherD(m)) / (0.75 * TRIP.castoff);
      out.throttle = k < 0.2 ? 0 : -1;
      const b = boardTimes(trip.start);
      out.dip = b.total - b.hop + t;
      return out;
    }
    case "turn": {
      const s = (V_SWUNG * t * t) / (2 * SWING_T), yaw = CAST.yaw + s / SWING_R;
      out.x = SWING_C.x - SWING_R * Math.cos(yaw);
      out.z = SWING_C.z + SWING_R * Math.sin(yaw);
      out.yaw = yaw;
      out.speed = (V_SWUNG * t) / SWING_T;
      out.throttle = 0.55;
      out.lines = 0;
      return out;
    }
    case "sail": case "veil": {
      // Out of the swing, opening up to sea speed; under the veil, on at it.
      const s = phase === "sail" ? V_SWUNG * t + ((V_SEA - V_SWUNG) * t * t) / (2 * TRIP.sail) : SAIL_LEN + V_SEA * t;
      if (phase === "veil" && trip.leg === "in") return out; // a first login's veil: the boat is still out at sea, unseen
      out.x = SWUNG.x + fwdX(OUT_YAW) * s;
      out.z = SWUNG.z + fwdZ(OUT_YAW) * s;
      out.yaw = OUT_YAW;
      out.speed = phase === "sail" ? V_SWUNG + ((V_SEA - V_SWUNG) * t) / TRIP.sail : V_SEA;
      out.throttle = 1;
      out.lines = 0;
      return out;
    }
    case "load": case "arrive": {
      // Coming in from the sea (waiting out there while the island loads), easing off toward the berth.
      const tt = phase === "load" ? 0 : Math.min(t, ARRIVE_T);
      const s = V_IN * tt + ((V_ALONGSIDE - V_IN) * tt * tt) / (2 * ARRIVE_T), u = arcU(s);
      out.x = bez(u, 0);
      out.z = bez(u, 1);
      out.yaw = Math.atan2(bezD(u, 0), bezD(u, 1));
      out.speed = V_IN + ((V_ALONGSIDE - V_IN) * tt) / ARRIVE_T;
      out.throttle = 1 - 0.8 * (tt / ARRIVE_T);
      out.lines = 0;
      return out;
    }
    case "dock": {
      // Alongside: drifting in the last of the way on a Hermite curve, the bow coming straight; the hull meets the fenders, the lines go over.
      const T = TRIP.dock, k = Math.min(1, t / T);
      const h00 = 2 * k ** 3 - 3 * k * k + 1, h10 = k ** 3 - 2 * k * k + k, h01 = -2 * k ** 3 + 3 * k * k;
      const vx = fwdX(IN_TO.yaw) * V_ALONGSIDE * T, vz = fwdZ(IN_TO.yaw) * V_ALONGSIDE * T;
      out.x = h00 * IN_TO.x + h10 * vx + h01 * MOORED.x;
      out.z = h00 * IN_TO.z + h10 * vz + h01 * MOORED.z;
      out.yaw = IN_TO.yaw + (MOORED.yaw - IN_TO.yaw) * smoother(k);
      const d00 = 6 * k * k - 6 * k, d10 = 3 * k * k - 4 * k + 1, d01 = -6 * k * k + 6 * k;
      out.speed = Math.hypot(d00 * IN_TO.x + d10 * vx + d01 * MOORED.x, d00 * IN_TO.z + d10 * vz + d01 * MOORED.z) / T;
      out.throttle = 0.2 * (1 - k);
      out.lines = smooth(BUMP_AT, 1, k);
      out.bump = k >= BUMP_AT ? t - BUMP_AT * T : -1;
      return out;
    }
    case "land": {
      out.bump = t + (1 - BUMP_AT) * TRIP.dock;
      out.dip = t >= LAND.rise ? t - LAND.rise : -1;
      return out;
    }
    default: return out;
  }
}

// ── The rider ──────────────────────────────────────────────────────────────────────────────────────────────────────
export interface RiderPlace {
  /** 0 on the pier, 1 on the bench, between: mid-step (the drawn point blends the two). */
  aboard: number;
  /** On the pier: where (the dock's frame) and which way they face. Aboard they face the bow. */
  x: number; z: number; yaw: number;
  /** Walking pace (u/s), for the walk clip and footsteps. */
  speed: number;
  /** Sitting on the bench. */
  seated: boolean;
  /** How high the step lifts them over the straight line between pier and bench. */
  arc: number;
  /** In the step (the Jump clip plays as it starts). */
  hop: boolean;
}
export const newRiderPlace = (): RiderPlace => ({ aboard: 0, x: ASHORE.x, z: ASHORE.z, yaw: 0, speed: 0, seated: false, arc: 0, hop: false });

/** Where the traveller is at `now`: walking the pier, stepping aboard or ashore, or on the bench. */
export function riderPlace(trip: BoatTrip, now: number, out: RiderPlace): RiderPlace {
  const [phase, t] = drawn(trip, now);
  out.speed = 0; out.arc = 0; out.hop = false;
  const facing = Math.PI / 2; // toward the boat (+x)
  if (phase === "board") {
    const b = boardTimes(trip.start), s = stepAt(trip.start), dx = STEP_AT.x - s.x, dz = STEP_AT.z - s.z;
    const walkYaw = b.walk > 0 ? Math.atan2(dx, dz) : s.yaw;
    if (t < b.walk) {
      const k = t / b.walk;
      Object.assign(out, { aboard: 0, seated: false, x: s.x + dx * smoother(k), z: s.z + dz * smoother(k), yaw: lerpAngle(s.yaw, walkYaw, smooth(0, 0.15, t)) });
      out.speed = (Math.hypot(dx, dz) * smootherD(k)) / b.walk;
      return out;
    }
    if (t < b.face) return Object.assign(out, { aboard: 0, seated: false, x: STEP_AT.x, z: STEP_AT.z, yaw: lerpAngle(walkYaw, facing, smooth(b.walk, b.face, t)) });
    if (t < b.hop) {
      const k = (t - b.face) / TRIP.hop;
      return Object.assign(out, { aboard: smoother(k), seated: false, x: STEP_AT.x, z: STEP_AT.z, yaw: facing, arc: TRIP.hopHeight * Math.sin(Math.PI * k), hop: true });
    }
    return Object.assign(out, { aboard: 1, seated: true, x: STEP_AT.x, z: STEP_AT.z, yaw: facing });
  }
  if (phase === "land") {
    const ashoreYaw = Math.atan2(ASHORE.x - STEP_AT.x, ASHORE.z - STEP_AT.z), away = -Math.PI / 2;
    if (t < LAND.rise) return Object.assign(out, { aboard: 1, seated: t < 0.05, x: STEP_AT.x, z: STEP_AT.z, yaw: away });
    if (t < LAND.hop) {
      const k = (t - LAND.rise) / TRIP.hop;
      return Object.assign(out, { aboard: 1 - smoother(k), seated: false, x: STEP_AT.x, z: STEP_AT.z, yaw: away, arc: TRIP.hopHeight * 0.7 * Math.sin(Math.PI * k), hop: true });
    }
    if (t < LAND.walk) {
      const k = (t - LAND.hop) / LAND_WALK, dx = ASHORE.x - STEP_AT.x, dz = ASHORE.z - STEP_AT.z;
      Object.assign(out, { aboard: 0, seated: false, x: STEP_AT.x + dx * smoother(k), z: STEP_AT.z + dz * smoother(k), yaw: lerpAngle(away, ashoreYaw, smooth(0, 0.22, t - LAND.hop)) });
      out.speed = (Math.hypot(dx, dz) * smootherD(k)) / LAND_WALK;
      return out;
    }
    return Object.assign(out, { aboard: 0, seated: false, x: ASHORE.x, z: ASHORE.z, yaw: lerpAngle(ashoreYaw, 0, smooth(LAND.walk, LAND.total, t)) });
  }
  if (phase === "reveal" || phase === "done") return Object.assign(out, { aboard: 0, seated: false, x: ASHORE.x, z: ASHORE.z, yaw: 0 });
  // Out at sea, sailing, waiting, coming in: on the bench.
  return Object.assign(out, { aboard: 1, seated: true, x: STEP_AT.x, z: STEP_AT.z, yaw: facing });
}

// ── The camera ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** How the trip frames itself: a heading in the dock's frame (0 looks inland along the pier), the tilt and zoom (null: the player's own), and whether to cut there (under the veil). */
export interface TripFraming { yaw: number; pitch: number | null; zoom: number | null; cut: boolean }
const LEAVING: TripFraming = { yaw: -0.45, pitch: 0.38, zoom: 1.3, cut: false };
const COMING_IN: TripFraming = { yaw: 0.3, pitch: 0.42, zoom: 1.25, cut: false };
const ASHORE_VIEW: TripFraming = { yaw: 0, pitch: null, zoom: null, cut: false };
/**
 * The trip's shots, steered gently like the auto-follow (the mouse, the arrows and two fingers still look round):
 * leaving, from out to sea back at the island as it falls behind; coming in, from behind the boat toward the pier;
 * ashore, the walking view looking inland. Boarding is yours.
 */
export function tripFraming(trip: BoatTrip): TripFraming | null {
  switch (trip.phase) {
    case "castoff": case "turn": case "sail": return LEAVING;
    case "veil": return trip.leg === "in" ? null : LEAVING;
    case "load": return trip.skip ? { ...ASHORE_VIEW, cut: true } : { ...COMING_IN, cut: true };
    case "arrive": return COMING_IN;
    case "dock": case "land": return ASHORE_VIEW;
    case "reveal": return { ...ASHORE_VIEW, cut: true };
    default: return null;
  }
}
