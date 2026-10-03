/**
 * A scripted ride of an avatar (the boat trip, specs/polish/arrival-wharf.md): while `active`, whoever drives it places
 * and poses the avatar each frame (the feet, the facing, a walking pace, seated on a bench, the step's hop, the body
 * tilting with the boat) and says what the camera follows; the avatar's own walker waits, and picks up where the ride
 * leaves it. One per travelling avatar, so anyone's trip can be drawn on their avatar (multiplayer-forward).
 */
export interface AvatarRide {
  active: boolean;
  /** The feet (world) and which way they face. */
  x: number; y: number; z: number; yaw: number;
  /** Walking pace (u/s): the walk clip and footsteps; 0 still. */
  speed: number;
  /** Seated (the Sit pose), the body this far up off the feet (lib/game/character/clips.ts seatLift). */
  seated: boolean; lift: number;
  /** The body tilts with what carries it (radians): about the way it faces, and across it. */
  roll: number; pitch: number;
  /** A step starts (the Jump clip plays once) or ends (it stops): set by the driver, taken by the avatar. */
  hop: boolean; land: boolean;
  /** What the follow camera looks at: steadier than the feet (a boat's course, without its bob). */
  focus: { x: number; y: number; z: number };
  /** Footsteps (sound and dust) while walking on this. */
  ground: "wood" | null;
}

export const newRide = (): AvatarRide => ({
  active: false, x: 0, y: 0, z: 0, yaw: 0, speed: 0, seated: false, lift: 0, roll: 0, pitch: 0, hop: false, land: false,
  focus: { x: 0, y: 0, z: 0 }, ground: null,
});
