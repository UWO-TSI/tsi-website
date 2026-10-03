"use client";

/**
 * A boat on a trip (specs/polish/arrival-wharf.md deliverable 3): what the wharf's boat does while a trip has it. Its
 * course comes from the trip (lib/game/boatTrip.ts boatPose); after it is floated each frame, the traveller rides it
 * (their avatar's ride: the walk down the pier, the step aboard, the bench, the step ashore and the walk up), its wake
 * and spray come off it, rings spread where it dips or bumps, and the traveller's own camera is steered to the trip's
 * shots. The traveller's own client also steps the trip on. All of it is drawn from the trip and the world clock, so a
 * trip someone else is making draws the same boat, wake and rider (on their avatar) wherever it is shown.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { boatPose, newRiderPlace, riderPlace, stepTrip, tripFraming, type BoatTrip, type RiderPlace } from "@/lib/game/boatTrip";
import { myTrip, tripChanged } from "@/lib/game/myTrip";
import { BOAT, SEA_Y, dockToWorld, mooredPose, type BoatPose, type Dock, type Float } from "@/lib/game/wharf";
import { boatRings, boatWake, newWake, type Wake } from "@/lib/game/boatFx";
import { seatLift } from "@/lib/game/character/clips";
import { steerOrbit } from "@/lib/game/orbitCamera";
import { AudioManager } from "@/lib/game/audio";
import type { AvatarRide } from "@/lib/game/movement/ride";
import type { IslandLight } from "@/lib/game/islandLighting";
import type { ParticlePool } from "@/lib/game/fx/particles";
import { CHARACTER_SCALE } from "../character/Character";
import { useMoveParticles } from "../movement/moveFx";
import { liveSwell, type OnPlaced, type PoseAt } from "./Boat";

/** Sitting on the bench: the Sit clip's seat lifted to its top over the boat's floor. */
const SIT_LIFT = seatLift("Sit", BOAT.seat - BOAT.floor, CHARACTER_SCALE);
/** The camera follows the boat's course this high over the water while you are aboard (not its bob). */
const FOCUS_ABOARD = SEA_Y + 0.5;

interface TripState { rider: RiderPlace; wake: Wake; hop: boolean; dip: number; bump: number }
const _seat = new THREE.Vector3(), _w = { x: 0, z: 0 }, _b = { x: 0, z: 0 };
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Module scope (the react compiler forbids writing through hook values): one frame of a trip on its boat, as placed. */
function tripFrame(trip: BoatTrip, own: boolean, dock: Dock, pose: BoatPose, float: Float, group: THREE.Group, now: number, dt: number,
  ride: AvatarRide, st: TripState, pool: ParticlePool, tint: number) {
  const r = riderPlace(trip, now, st.rider), a = r.aboard;
  // The bench, wherever the boat is and however it leans; the step on the pier; and between them, mid-step, the arc.
  _seat.set(BOAT.seatAt[0], BOAT.floor, BOAT.seatAt[1]).applyMatrix4(group.matrix);
  dockToWorld(dock, r.x + (_seat.x - r.x) * a, r.z + (_seat.z - r.z) * a, _w);
  ride.x = _w.x; ride.z = _w.z; ride.y = _seat.y * a + r.arc;
  const boatYaw = pose.yaw + dock.yaw;
  ride.yaw = lerpAngle(r.yaw + dock.yaw, boatYaw, a);
  ride.speed = r.speed; ride.seated = r.seated; ride.lift = SIT_LIFT;
  ride.roll = float.roll * a; ride.pitch = float.pitch * a;
  ride.ground = a < 0.5 ? "wood" : null;
  if (r.hop && !st.hop) ride.hop = true;
  // Landing from the step: on the boards or the boat's floor.
  if (!r.hop && st.hop) { ride.land = true; AudioManager.playSFX("footstep", { rate: 0.92, gain: 0.85 }); }
  st.hop = r.hop;
  // The camera: the boat's steady course while aboard, the walker on the pier.
  dockToWorld(dock, pose.x, pose.z, _b);
  ride.focus.x = ride.x + (_b.x - ride.x) * a;
  ride.focus.z = ride.z + (_b.z - ride.z) * a;
  ride.focus.y = (ride.y - r.arc) + (FOCUS_ABOARD - (ride.y - r.arc)) * a;
  // A first login's veil coming up over the island: the avatar stays where it stands until the veil hides the move aboard.
  ride.active = trip.phase !== "done" && !(trip.from === "sea" && trip.phase === "veil");
  // The wake and spray off it; rings where it dips under a step or bumps the fenders (its starboard side, the pier's).
  boatWake(pool, st.wake, dt, _b.x, _b.z, boatYaw, pose.speed, pose.throttle, tint, liveSwell.t);
  if ((pose.dip >= 0 && st.dip < 0) || (pose.bump >= 0 && st.bump < 0)) boatRings(pool, _b.x, _b.z, boatYaw, -1, tint, liveSwell.t);
  st.dip = pose.dip; st.bump = pose.bump;
  // The traveller's own camera: the trip's shot (the player's own tilt and zoom where it gives none).
  if (own) {
    const shot = tripFraming(trip);
    if (shot) steerOrbit(dt, dock.yaw + shot.yaw, shot.pitch ?? myTrip.camera.pitch, shot.zoom ?? myTrip.camera.zoom, shot.cut);
  }
}

/** The wharf boat's course and what follows it: moored with no trip, else the trip's. `ride`: the traveller's avatar. */
export function useTripBoat(trip: BoatTrip | null, dock: Dock, light: IslandLight, ride: AvatarRide): { poseAt: PoseAt; onPlaced?: OnPlaced } {
  const pool = useMoveParticles().pool;
  const state = useRef<TripState>({ rider: newRiderPlace(), wake: newWake(), hop: false, dip: -1, bump: -1 });
  const tint = light.water.foamColor;
  return useMemo(() => {
    if (!trip) return { poseAt: (_now: number, out: BoatPose) => { mooredPose(out); } };
    const own = trip.who === "me";
    return {
      poseAt: (now: number, out: BoatPose) => {
        if (own && stepTrip(trip, now, myTrip.loaded)) tripChanged();
        boatPose(trip, now, out);
      },
      onPlaced: (pose: BoatPose, float: Float, group: THREE.Group, now: number, dt: number) =>
        tripFrame(trip, own, dock, pose, float, group, now, dt, ride, state.current, pool, tint),
    };
  }, [trip, dock, ride, pool, tint]);
}
