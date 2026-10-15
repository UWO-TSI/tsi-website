/**
 * The wharf and the home island's pier (specs/polish/arrival-wharf.md): the pier model's frame (art/wharf/build_wharf.py
 * prints these), the boat, where it moors and where you step aboard and ashore. Everything here is in a dock's own
 * frame, the wharf landmark's before its yaw: x across (+x the boat's side), z along the pier (−z out to sea, the tip
 * at −3.5), y up with the deck's top at 0 (the walk height on WHARF_DECK_LOCAL) and the sea a hand lower.
 */
import { WATER_DROP } from "./grid";
import { waterWaveAt, type WaveState } from "./waves";
import { waterFieldAt } from "./waterField";

/** Where a dock stands in the world: the pier's origin and its turn about +y (radians, three's rotation.y). */
export interface Dock { x: number; z: number; yaw: number }

export const PIER_URL = "/assets/game/wharf/pier.glb";
/** The sea's surface in a dock's frame (level 0's water). */
export const SEA_Y = -WATER_DROP;
/** The pier as built: its ends, the standing piles (x, then each z on both sides), the gap on +x where you step aboard, the cleat the bow line is made fast to and the tip pile the stern line goes round. */
export const PIER = {
  tip: -3.5, land: 1.12, postX: 1.06, postR: 0.085, railZ: [-3.42, -1.62, -0.28, 1.0], gap: [-3.42, -1.62],
  /** The piles under the deck that stop short of it (x either side, each z). */
  underX: 0.84, underZ: [-2.5, -0.95, 0.35],
  bowCleat: [0.8, 0.066, -1.98], sternPost: [1.06, 0.3, -3.42],
} as const;

/**
 * ACNH's little motor boat (props/boat.glb) at the dump's scale. Its own frame: the bow along +z, the origin at the
 * propeller's foot. Heights are over that origin; it floats with `draft` of it under the water (the red paint's top).
 */
export const BOAT = {
  url: "/assets/acnh/props/boat.glb",
  scale: 0.1,
  draft: 0.47,
  /** The floor inside, the bench's top, the gunwale. */
  floor: 0.645, seat: 0.81, gunwale: 0.93,
  /** The bench you sit on, facing the bow (x, z). */
  seatAt: [0, 0.58],
  /** The hull: its stem and transom along z, half its beam, the propeller's z, the motor's top. */
  bow: 1.9, stern: -1.1, beam: 1.0, prop: -1.42, motor: [0, 1.25, -1.32],
  /** Where its lines are made fast on the starboard gunwale (the side against the pier): bow, stern. */
  bowLine: [-0.72, 0.93, 1.3], sternLine: [-0.9, 0.93, -0.9],
  /** The bow lantern's glass (it is lit at night). */
  lantern: [-0.6, 0.98, 1.52],
} as const;

/** The boat moored alongside the tip on +x, its bow toward land, its fenders against the pier's. */
export const MOORED = { x: 2.32, z: -2.92, yaw: 0 } as const;
/** Where you stand on the pier to step aboard (and land when you step ashore): beside the bench, in the rail's gap. */
export const STEP_AT = { x: 0.62, z: -2.34 } as const;
/** Where you arrive: the pier's land end (LANDMARK_INFO.wharf's exit), facing inland. */
export const ASHORE = { x: 0, z: 1.1 } as const;
/** The prompt to take the boat: LANDMARK_INFO.wharf's door, by the gap. */
export const BOARDING = { x: 0, z: -2.5, range: 1.6 } as const;

/**
 * The village wharf's dressing (v1 water item 7, art/wharf/build_wharf.py; references/look/2026-10-13/
 * wharf-creatures-of-the-deep-ref.png): a finger pier off the tip on -x (the boat's side is +x), its posts standing up
 * past the deck, two lantern poles, and small rowboats moored along the finger. In the dock's frame, as built.
 */
export const DRESSING_URL = "/assets/game/wharf/wharf-dressing.glb";
export const ROWBOAT_URL = "/assets/game/wharf/rowboat.glb";
export const FINGER = { x0: -4.7, x1: -0.95, z0: -3.5, z1: -2.25, postX: [-2.0, -3.3, -4.6], postR: 0.085, postTop: 0.3 } as const;
/** The lantern poles (x, z): the finger's far corner and the jetty's land end. */
export const LANTERNS: readonly (readonly [number, number])[] = [[-4.6, -3.53], [-1.25, 0.72]];
/** A rowboat as built (rowboat.glb): its length and beam, how deep it sits, and where its painter (bow line) is made fast. */
export const ROWBOAT = { length: 1.55, beam: 0.62, draft: 0.09, bowRing: [0, 0.24, 0.7] } as const;
/** Where each rowboat lies moored (its middle; `yaw` turns its bow off +z) and the finger post its line goes to. */
export const ROWBOATS: readonly { x: number; z: number; yaw: number; post: readonly [number, number] }[] = [
  { x: -2.65, z: -3.97, yaw: -Math.PI / 2, post: [-2.0, -3.53] },
  { x: -3.75, z: -1.8, yaw: -Math.PI / 2 + 0.16, post: [-3.3, -2.22] },
];

/** Two buoys flanking the boat's lane off the tip (the channel in and out), in the dock's frame. */
export const BUOYS: readonly (readonly [number, number])[] = [[1.4, -8.6], [9.6, -10.2]];

/** Where a boat lies, in a dock's frame (lib/game/boatTrip.ts moves it on a trip). */
export interface BoatPose {
  /** Its origin and heading (bow along (sin yaw, cos yaw)). */
  x: number; z: number; yaw: number;
  /** Speed through the water (u/s), and the motor: −1 astern, 0 idle, 1 ahead. */
  speed: number; throttle: number;
  /** Its lines on the pier: 1 made fast, 0 aboard. */
  lines: number;
  /** Seconds since someone stepped aboard or ashore (it dips under them), and since its hull met the fenders; −1: none lately. */
  dip: number; bump: number;
}
export const newBoatPose = (): BoatPose => ({ x: MOORED.x, z: MOORED.z, yaw: MOORED.yaw, speed: 0, throttle: 0, lines: 1, dip: -1, bump: -1 });
/** The boat as it lies moored between trips. */
export function mooredPose(out: BoatPose): BoatPose {
  out.x = MOORED.x; out.z = MOORED.z; out.yaw = MOORED.yaw;
  out.speed = 0; out.throttle = 0; out.lines = 1; out.dip = -1; out.bump = -1;
  return out;
}

/** The sea's waves as the water draws them this frame (lib/game/waves.ts liveWaves; a test's waveState). */
export type Swell = WaveState;
/** How something sits on the water: the surface's height under it (world y; the model subtracts its own waterline), its pitch (rotation.x, bow up negative) and roll (rotation.z, port up positive), and a sway off the pier (the dock's +x). */
export interface Float { y: number; pitch: number; roll: number; sway: number }
export const newFloat = (): Float => ({ y: 0, pitch: 0, roll: 0, sway: 0 });

/**
 * A hull's ride on the waves: where it is and how fast it moves toward the plane the water under it makes. It follows
 * that plane on a spring a touch under critical damping, so it rocks with the waves, lags them by a fraction of a
 * second and settles instead of snapping to each sample (`RIDE`). Per boat, carried frame to frame.
 */
export interface Ride { y: number; vy: number; pitch: number; vp: number; roll: number; vr: number; on: boolean }
export const newRide = (): Ride => ({ y: 0, vy: 0, pitch: 0, vp: 0, roll: 0, vr: 0, on: false });
/** The spring: heave and tilt rates (rad/s; a boat heaves quicker than it tips) and the damping ratio. */
export const RIDE = { heave: 5, tilt: 3.6, damping: 0.72 } as const;
const STEP = 1 / 120;
/** One frame of a ride toward the plane `to` (dt seconds, sub-stepped so a long frame stays stable). */
export function followPlane(r: Ride, to: { y: number; pitch: number; roll: number }, dt: number): Ride {
  if (!r.on || dt <= 0 || dt > 1) {
    // First frame, or back from a long pause: on the water where it is, at rest.
    r.y = to.y; r.pitch = to.pitch; r.roll = to.roll; r.vy = r.vp = r.vr = 0; r.on = true;
    return r;
  }
  for (let left = dt; left > 1e-6; left -= STEP) {
    const h = Math.min(STEP, left), hw = RIDE.heave, tw = RIDE.tilt, z = RIDE.damping;
    r.vy += (hw * hw * (to.y - r.y) - 2 * z * hw * r.vy) * h; r.y += r.vy * h;
    r.vp += (tw * tw * (to.pitch - r.pitch) - 2 * z * tw * r.vp) * h; r.pitch += r.vp * h;
    r.vr += (tw * tw * (to.roll - r.roll) - 2 * z * tw * r.vr) * h; r.roll += r.vr * h;
  }
  return r;
}

/** Least-squares plane h = a + b·u + c·v through `n` points (u along across, v along the length), into `out`. */
export function fitPlane(u: ArrayLike<number>, v: ArrayLike<number>, h: ArrayLike<number>, n: number, out: { a: number; b: number; c: number }) {
  let su = 0, sv = 0, sh = 0, suu = 0, svv = 0, suv = 0, suh = 0, svh = 0;
  for (let i = 0; i < n; i++) {
    su += u[i]; sv += v[i]; sh += h[i]; suu += u[i] * u[i]; svv += v[i] * v[i]; suv += u[i] * v[i]; suh += u[i] * h[i]; svh += v[i] * h[i];
  }
  // Centred, the a term drops out of the 2 × 2 for the slopes.
  const mu = su / n, mv = sv / n, mh = sh / n;
  const cuu = suu - n * mu * mu, cvv = svv - n * mv * mv, cuv = suv - n * mu * mv, cuh = suh - n * mu * mh, cvh = svh - n * mv * mh;
  const det = cuu * cvv - cuv * cuv;
  out.b = Math.abs(det) > 1e-12 ? (cuh * cvv - cvh * cuv) / det : 0;
  out.c = Math.abs(det) > 1e-12 ? (cvh * cuu - cuh * cuv) / det : 0;
  out.a = mh - out.b * mu - out.c * mv;
  return out;
}

/** Where the hull meets the water, in the boat's frame (x across, + port; z along, + the bow): bow, stern, port, starboard. */
const HULL = { mid: 0.4, bow: 1.5, stern: -0.7, side: 0.9 };
const HULL_U = [0, 0, HULL.side, -HULL.side], HULL_V = [HULL.bow, HULL.stern, HULL.mid, HULL.mid];
const _h = new Float64Array(4), _plane = { a: 0, b: 0, c: 0 }, _to = { y: 0, pitch: 0, roll: 0 }, at = { x: 0, z: 0 }, _g = { x: 0, z: 0 };
/**
 * The plane the water makes under a hull at (x, z, yaw) in a dock's frame: the waves' height (lib/game/waves.ts
 * waterWaveAt, on the field the shader reads) at each of its points (u across, v along), fitted by least squares; its
 * height at the hull's origin, its pitch and roll, into `_to`.
 */
function planeUnder(d: Dock, x: number, z: number, yaw: number, u: readonly number[], v: readonly number[], w: Swell) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < u.length; i++) {
    dockToWorld(d, x + u[i] * c + v[i] * s, z - u[i] * s + v[i] * c, at);
    _h[i] = waterWaveAt(at.x, at.z, w, _g, waterFieldAt);
  }
  fitPlane(u, v, _h, u.length, _plane);
  _to.y = SEA_Y + _plane.a;
  _to.pitch = -Math.atan(_plane.c);
  _to.roll = Math.atan(_plane.b);
  return _to;
}

const TAU = Math.PI * 2;
/**
 * A boat on the waves (the ones the water draws, lib/game/waves.ts) at the waves' time: the plane the water makes under
 * its bow, stern and sides sets its height, pitch and roll, followed on a spring (`ride`, carried frame to frame, `dt`
 * the frame; none: on the plane exactly). On top, the reactions, each a damped swing that starts from rest: a dip toward
 * the pier as someone steps aboard or ashore, a roll and push off the fenders as it comes alongside; going, it noses up
 * and skips over the chop, backing out its stern squats. The waves and the pose are the world clock's, so every client
 * floats it the same.
 */
export function floatBoat(d: Dock, pose: BoatPose, w: Swell, out: Float, ride?: Ride, dt = 0): Float {
  const t = w.t;
  const to = planeUnder(d, pose.x, pose.z, pose.yaw, HULL_U, HULL_V, w);
  if (ride) followPlane(ride, to, dt);
  const r = ride ?? to;
  out.y = r.y; out.pitch = r.pitch; out.roll = r.roll;
  out.sway = 0;
  if (pose.dip >= 0) {
    const e = Math.exp(-2.6 * pose.dip);
    out.y -= 0.09 * e * Math.sin(TAU * 1.1 * pose.dip);
    out.roll -= 0.07 * Math.exp(-2.4 * pose.dip) * Math.sin(TAU * 1.0 * pose.dip);
  }
  if (pose.bump >= 0) {
    const e = Math.exp(-3 * pose.bump);
    out.sway += 0.035 * e * Math.sin(TAU * 0.9 * pose.bump);
    out.roll += 0.045 * e * Math.sin(TAU * 1.2 * pose.bump);
  }
  const going = Math.min(1, pose.speed / 7);
  if (pose.throttle > 0) {
    out.pitch -= 0.045 * going * pose.throttle;
    out.pitch += 0.014 * going * Math.sin(t * 8.3);
    out.y += 0.012 * going * Math.sin(t * 10.7 + 1);
  } else if (pose.throttle < 0) out.pitch += 0.015 * Math.min(1, pose.speed / 0.8);
  return out;
}

/** A buoy's float: three points round it (a small float rides the water hard: its lean is the plane's, doubled). */
const BUOY_R = 0.2, BUOY_U = [0, BUOY_R * 0.866, -BUOY_R * 0.866], BUOY_V = [BUOY_R, -BUOY_R * 0.5, -BUOY_R * 0.5], BUOY_LEAN = 2.2;
/**
 * A buoy at (x, z) in a dock's frame, turned `yaw` about its stem: on the plane the water makes under it, leaning with
 * it (pitch and roll in its own frame), and wobbling lazily.
 */
export function floatBuoy(d: Dock, x: number, z: number, w: Swell, out: Float, ride?: Ride, dt = 0, yaw = 0): Float {
  const t = w.t;
  const to = planeUnder(d, x, z, yaw, BUOY_U, BUOY_V, w);
  to.pitch *= BUOY_LEAN; to.roll *= BUOY_LEAN;
  if (ride) followPlane(ride, to, dt);
  const r = ride ?? to;
  const phase = x * 0.37 + z * 0.61;
  out.y = r.y;
  out.roll = r.roll + 0.05 * Math.sin(t * 1.3 + phase);
  out.pitch = r.pitch + 0.04 * Math.sin(t * 1.1 + phase * 1.7);
  out.sway = 0;
  return out;
}

/** A rowboat's hull points (as floatBoat's, its own length and beam). */
const ROW_HALF = ROWBOAT.length * 0.4, ROW_SIDE = ROWBOAT.beam * 0.4;
const ROW_U = [0, 0, ROW_SIDE, -ROW_SIDE], ROW_V = [ROW_HALF, -ROW_HALF, 0, 0];
/**
 * A rowboat moored at `rb` on the waves: on the plane the water makes under its bow, stern and sides (as floatBoat, a
 * smaller hull, on its own `ride`), and a lazy tug at its line.
 */
export function floatRowboat(d: Dock, rb: { x: number; z: number; yaw: number }, w: Swell, out: Float, ride?: Ride, dt = 0): Float {
  const t = w.t;
  const to = planeUnder(d, rb.x, rb.z, rb.yaw, ROW_U, ROW_V, w);
  if (ride) followPlane(ride, to, dt);
  const r = ride ?? to;
  const phase = rb.x * 0.73 + rb.z * 0.41;
  out.y = r.y;
  out.pitch = r.pitch + 0.012 * Math.sin(t * 0.8 + phase);
  out.roll = r.roll + 0.02 * Math.sin(t * 0.63 + phase * 1.7);
  out.sway = 0.03 * Math.sin(t * 0.21 + phase);
  return out;
}

/** A point in a dock's frame to the world (x, z), into `out`. */
export function dockToWorld(d: Dock, x: number, z: number, out: { x: number; z: number }) {
  const c = Math.cos(d.yaw), s = Math.sin(d.yaw);
  out.x = d.x + x * c + z * s;
  out.z = d.z - x * s + z * c;
  return out;
}
/** A world point (x, z) into a dock's frame, into `out`. */
export function worldToDock(d: Dock, x: number, z: number, out: { x: number; z: number }) {
  const c = Math.cos(d.yaw), s = Math.sin(d.yaw), dx = x - d.x, dz = z - d.z;
  out.x = dx * c - dz * s;
  out.z = dx * s + dz * c;
  return out;
}

/**
 * The berth, in the dock's frame: the water the jetty's tip, the finger pier, the moored boat and the rowboats need,
 * kept `depth` deep, its edge `edge` wide. The smooth world digs it into its heights (lib/game/world/convert.ts
 * wharfQuay); the village's seabed keeps it out of the sea's wide shallows (lib/game/seabed.ts setShoal).
 */
export const BERTH = { x0: -5.3, x1: 3.8, z0: -5.2, z1: -0.8, edge: 0.6, depth: 1.4 } as const;
const inDock = { x: 0, z: 0 };
/** How much of a dock's berth covers a world point: 1 inside, falling to 0 over `edge`. */
export function berthWeight(dock: { x: number; z: number; yaw?: number }, x: number, z: number, edge: number = BERTH.edge): number {
  const { x: lx, z: lz } = worldToDock({ x: dock.x, z: dock.z, yaw: dock.yaw ?? 0 }, x, z, inDock);
  const out = Math.hypot(Math.max(0, BERTH.x0 - lx, lx - BERTH.x1), Math.max(0, BERTH.z0 - lz, lz - BERTH.z1));
  if (out >= edge) return 0;
  const t = out / edge;
  return 1 - t * t * (3 - 2 * t);
}
