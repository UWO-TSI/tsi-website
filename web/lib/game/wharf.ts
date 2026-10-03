/**
 * The wharf and the home island's pier (specs/polish/arrival-wharf.md): the pier model's frame (art/wharf/build_wharf.py
 * prints these), the boat, where it moors and where you step aboard and ashore. Everything here is in a dock's own
 * frame, the wharf landmark's before its yaw: x across (+x the boat's side), z along the pier (−z out to sea, the tip
 * at −3.5), y up with the deck's top at 0 (the walk height on WHARF_DECK_LOCAL) and the sea a hand lower.
 */
import { WATER_DROP } from "./grid";
import { waterSwellAt } from "./waterShader";

/** Where a dock stands in the world: the pier's origin and its turn about +y (radians, three's rotation.y). */
export interface Dock { x: number; z: number; yaw: number }

export const PIER_URL = "/assets/game/wharf/pier.glb";
/** The sea's surface in a dock's frame (level 0's water). */
export const SEA_Y = -WATER_DROP;
/** The pier as built: its ends, the standing piles (x, then each z on both sides), the gap on +x where you step aboard, the cleat the bow line is made fast to and the tip pile the stern line goes round. */
export const PIER = {
  tip: -3.5, land: 1.12, postX: 1.06, postR: 0.085, railZ: [-3.42, -1.62, -0.28, 1.0], gap: [-3.42, -1.62],
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

/** The swell's live settings (the water's uniforms). */
export type Swell = { waveHeight: number; waveScale: number; waveSpeed: number };
/** How something sits on the water: the surface's height under it (world y; the model subtracts its own waterline), its pitch (rotation.x, bow up negative) and roll (rotation.z, port up positive), and a sway off the pier (the dock's +x). */
export interface Float { y: number; pitch: number; roll: number; sway: number }
export const newFloat = (): Float => ({ y: 0, pitch: 0, roll: 0, sway: 0 });

/** Where the hull meets the water, in the boat's frame: its middle along z, the bow and stern samples, the beam's. */
const HULL = { mid: 0.4, bow: 1.5, stern: -0.7, side: 0.9 };
const HULL_LEN = HULL.bow - HULL.stern, HULL_BEAM = 2 * HULL.side;
const at = { x: 0, z: 0 };
/** The swell at a point of the boat's frame. Module scope, no closures: called four times a frame per boat. */
function swellUnder(d: Dock, p: BoatPose, c: number, s: number, bx: number, bz: number, t: number, w: Swell) {
  dockToWorld(d, p.x + bx * c + bz * s, p.z - bx * s + bz * c, at);
  return waterSwellAt(at.x, at.z, t, w);
}
const TAU = Math.PI * 2;
/**
 * A boat on the shared swell (the same waves the water draws, lib/game/waterShader.ts waterSwellAt) at world time `t`
 * (s, the water's uTime): its height from the water under four points of the hull, its pitch and roll from their
 * differences. On top, the reactions, each a damped swing that starts from rest: a dip toward the pier as someone
 * steps aboard or ashore, a roll and push off the fenders as it comes alongside; going, it noses up and skips over the
 * chop, backing out its stern squats. All a function of the pose and time, so every client floats it the same.
 */
export function floatBoat(d: Dock, pose: BoatPose, t: number, w: Swell, out: Float): Float {
  const c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
  const bow = swellUnder(d, pose, c, s, 0, HULL.bow, t, w), stern = swellUnder(d, pose, c, s, 0, HULL.stern, t, w);
  const port = swellUnder(d, pose, c, s, HULL.side, HULL.mid, t, w), starboard = swellUnder(d, pose, c, s, -HULL.side, HULL.mid, t, w);
  out.y = SEA_Y + (bow + stern + port + starboard) / 4;
  out.pitch = Math.atan2(stern - bow, HULL_LEN);
  out.roll = Math.atan2(port - starboard, HULL_BEAM);
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

const grad = { x: 0, z: 0 };
/** A buoy at (x, z) in a dock's frame: the surface under it, and it leans with the water's slope (a small float rides it hard) and wobbles lazily. */
export function floatBuoy(d: Dock, x: number, z: number, t: number, w: Swell, out: Float): Float {
  dockToWorld(d, x, z, at);
  out.y = SEA_Y + waterSwellAt(at.x, at.z, t, w, grad);
  const phase = at.x * 0.37 + at.z * 0.61;
  out.roll = Math.atan(grad.x * 3) + 0.05 * Math.sin(t * 1.3 + phase);
  out.pitch = -Math.atan(grad.z * 3) + 0.04 * Math.sin(t * 1.1 + phase * 1.7);
  out.sway = 0;
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
