/**
 * The crossing's five shots (specs/v1-drop.md §1.4), staged like the title screen's (components/title/shots.ts): each a
 * framing that drifts slowly over its length, here relative to the boat as it comes in from far out (lib/game/boatTrip.ts
 * "cross"), always golden hour. A wide drone shot of the island coming out of the veil mist; a low shot off the bow;
 * a close-up of you, dripping; the wake; the wharf coming up. Pure: the arrival's director (components/game/arrival)
 * puts the island's camera where this says.
 *
 * Boat-local points: x to the boat's starboard (its +x, the pier side when moored), y up from the sea, z toward the bow.
 */
import type { CrossingShotId } from "./sequence";

type V3 = readonly [number, number, number];
/** Where the camera looks: a boat-local point, or a world point (the island's middle, the pier's tip). */
type Aim = { boat: V3 } | { world: "island" | "wharf"; y: number } | { blend: [{ boat: V3 }, { world: "island" | "wharf"; y: number }, number] };
export interface CrossingFrame { from: V3; to: V3; aim: Aim; aimTo?: Aim; fov: number; fovTo?: number }

export const CROSSING_FRAMES: Record<CrossingShotId, CrossingFrame> = {
  // High off the starboard quarter, pulling in: the island ahead in the middle of the frame, the boat small below it.
  drone: { from: [9, 11.5, -15], to: [6, 8.2, -9.5], aim: { blend: [{ boat: [0, 0, 14] }, { world: "island", y: 1.5 }, 0.55] }, fov: 40, fovTo: 38 },
  // Low beside the bow, just over the water, looking ahead past the stem: the bow wave, the island across the sea.
  bow: { from: [1.15, 0.42, 1.05], to: [1.1, 0.4, 1.75], aim: { boat: [-0.9, 0.85, 26] }, fov: 54 },
  // In front of you on the bench, close: your face, wet hair, drops running off.
  closeup: { from: [0.32, 1.28, 1.95], to: [0.2, 1.24, 1.72], aim: { boat: [0, 1.18, 0.58] }, fov: 30, fovTo: 28 },
  // Up behind the stern, looking back: the wake spreading out to the horizon, Bram at the tiller below.
  wake: { from: [1.7, 2.5, -0.9], to: [2.1, 3.0, -1.6], aim: { boat: [0, 0, -13] }, fov: 46 },
  // Over Bram's shoulder at the stern, ahead: the wharf coming up, the boat sliding in alongside.
  wharf: { from: [-0.75, 1.95, -2.7], to: [-0.6, 1.7, -2.2], aim: { blend: [{ boat: [0, 0.6, 12] }, { world: "wharf", y: 0.5 }, 0.7] }, fov: 44, fovTo: 40 },
};

const ease = (k: number) => k * k * (3 - 2 * k);
/** The boat in the world: where it floats (its origin on the water) and which way its bow points. */
export interface BoatWorld { x: number; y: number; z: number; yaw: number }
/** Fixed world points the shots look at: the island's middle and the pier's tip. */
export interface CrossingPoints { island: { x: number; z: number }; wharf: { x: number; z: number } }
export interface CameraOut { pos: [number, number, number]; look: [number, number, number]; fov: number }

function local(b: BoatWorld, p: V3, out: [number, number, number]) {
  const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  // The boat's +x in the world is (cos yaw, 0, -sin yaw), its +z (sin yaw, 0, cos yaw) (three's turn about +y).
  out[0] = b.x + p[0] * c + p[2] * s;
  out[1] = Math.max(0.25, b.y + p[1]);
  out[2] = b.z - p[0] * s + p[2] * c;
  return out;
}
const _a: [number, number, number] = [0, 0, 0], _b: [number, number, number] = [0, 0, 0];
function aimAt(a: Aim, b: BoatWorld, pts: CrossingPoints, out: [number, number, number]) {
  if ("boat" in a) return local(b, a.boat, out);
  if ("world" in a) { const w = pts[a.world]; out[0] = w.x; out[1] = a.y; out[2] = w.z; return out; }
  const [p, q, k] = a.blend;
  local(b, p.boat, _a);
  const w = pts[q.world];
  out[0] = _a[0] + (w.x - _a[0]) * k; out[1] = _a[1] + (q.y - _a[1]) * k; out[2] = _a[2] + (w.z - _a[2]) * k;
  return out;
}

/** The camera for shot `id`, `k` (0..1) through it, with the boat where it is now. */
export function crossingCamera(id: CrossingShotId, k: number, boat: BoatWorld, pts: CrossingPoints, out: CameraOut): CameraOut {
  const f = CROSSING_FRAMES[id], e = ease(Math.min(1, Math.max(0, k)));
  local(boat, [f.from[0] + (f.to[0] - f.from[0]) * e, f.from[1] + (f.to[1] - f.from[1]) * e, f.from[2] + (f.to[2] - f.from[2]) * e], out.pos);
  aimAt(f.aim, boat, pts, out.look);
  if (f.aimTo) {
    aimAt(f.aimTo, boat, pts, _b);
    for (let i = 0; i < 3; i++) out.look[i] += (_b[i] - out.look[i]) * e;
  }
  out.fov = f.fov + ((f.fovTo ?? f.fov) - f.fov) * e;
  return out;
}
