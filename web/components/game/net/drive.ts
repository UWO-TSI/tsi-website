/**
 * One remote player's frame (specs/multiplayer.md §5.4): their interpolated sample drives the same rig and clips yours
 * does. The driver (RemoteAvatars) runs it for every remote in one useFrame at priority -3, before Character (-1)
 * reads the motion. Module scope, nothing allocated per frame.
 *
 * - The anchor stands on the floor under them (the scene's `top`, below the water line where it's `wet`); the body
 *   lifts above it by the seat's height when they sit, otherwise by how high they are over it (a jump, a glide).
 * - Speed, yaw, the movement state, the Air pose and the leaf come from the sample; one-shots come from its events and
 *   only as clips this rig has (an unknown one-shot would stick as Idle in Puppet.update). Seated, a one-shot plays on
 *   the upper body so they don't float off the seat.
 * - The mixer's rate trick (Character.tsx: its frame returns early while `motion.current` is null and steps by
 *   `rate`): Reduced remotes step at 15 Hz by the time saved up, Hidden ones not at all, without touching Character.
 * - Sun shadows go through `userData.sunCaster` (SunShadows reads it before `castShadow`), off below Full; what a Full
 *   player holds casts only within HELD_SHADOW_RANGE of you (`motion.itemShadow`, Character `remote`).
 */
import * as THREE from "three";
import { WATER_DROP } from "@/lib/game/grid";
import { CLIP_BY_NAME, VERB_BY_NAME } from "@/lib/game/character/look";
import { SEAT_CLIPS, type CharacterMotion, type ClipName } from "@/lib/game/character/clips";
import { createRemoteSample, type RemoteEntry, type RemoteEvent, type RemoteSample } from "@/lib/net/types";
import { FULL, HIDDEN, LOD, createLodEntry, type LodEntry } from "./lod";
import { createFxState, type FxState } from "./fx";
import { FX_BENCH, fxOn } from "@/lib/game/perf/fxBench";
import { isEmoteClip } from "@/lib/net/protocol";

/** What remotes stand on: the scene's walk world (movement's `top` and `wet`). Interiors are flat. */
export interface GroundWorld {
  top(x: number, z: number): number; wet(x: number, z: number): boolean;
  /** A room (InteriorPlayer's walker: no jump): the sender's y is its floor, so a stair or an upper level stands where it is. */
  room?: boolean;
}
export const FLAT_GROUND: GroundWorld = { top: () => 0, wet: () => false };
export const ROOM_GROUND: GroundWorld = { top: () => 0, wet: () => false, room: true };

/**
 * Clips a seat holds (lib/game/character/clips SEAT_CLIPS: a bench, a bed, the ground, the campfire's rings): there the
 * wire's `lift` is the seat's, they stand still in it however the seat moves (the stomp ring carries a dancer round
 * the fire), and a one-shot goes to the upper body.
 */
export { SEAT_CLIPS };
/** Movement states on the ground: their speed paces the clip (any other plays at speed 0, as PlayerAvatar has it). */
const GROUND_MOVES: ReadonlySet<string> = new Set(["CrouchWalk", "CrouchIdle"]);
/** A clip this rig has (the village set or the verb library). */
export const knownClip = (name: unknown): name is ClipName => typeof name === "string" && (CLIP_BY_NAME.has(name) || VERB_BY_NAME.has(name));

/** A remote player's state between frames: everything the driver writes is preallocated here. */
export interface RemoteRig {
  readonly sid: number;
  /** The registry's entry: its `player` is replaced (not mutated) when their card or slow state changes. */
  entry: RemoteEntry;
  readonly sample: RemoteSample;
  /** Written every frame; Character reads it through `live`. */
  readonly motion: CharacterMotion;
  /** What Character reads: `motion` on a frame its mixer steps, null to skip it (Reduced between ticks, Hidden). */
  readonly live: { current: CharacterMotion | null };
  /** What the step dust reads: `motion` at Full, else null. */
  readonly dust: { current: CharacterMotion | null };
  /** The group at the floor under them (Character's parent: its contact shadow sits under it), while mounted. */
  readonly anchor: { current: THREE.Group | null };
  /** Their feet this frame: the aura's centre. */
  readonly feet: { current: THREE.Vector3 };
  /** The floor under the feet: the anchor's height. */
  groundY: number;
  /** The walk world's top under them (the water's surface where it's wet). */
  waterY: number;
  /** The floor lookup, kept until they move 2 cm. */
  floorX: number; floorZ: number; floorY: number; floorWorld: GroundWorld | null;
  /** Sitting (a seat clip held). */
  seated: boolean;
  /** The held clip last asserted from the sample: let go of only on its falling edge (see driveRig). */
  heldPose: ClipName | null;
  readonly lod: LodEntry;
  /** Reduced: time saved up for the next mixer step. */
  mixerT: number;
  /** Sun shadows as last applied (null: not yet). */
  casting: boolean | null;
  /** The juice in progress (a dash's streaks). */
  readonly fx: FxState;
}

export function createRig(entry: RemoteEntry): RemoteRig {
  const motion: CharacterMotion = { speed: 0, yaw: 0, lift: 0, pose: null, play: null, move: null };
  return {
    sid: entry.sid, entry, sample: createRemoteSample(), motion, live: { current: null }, dust: { current: null }, anchor: { current: null },
    feet: { current: new THREE.Vector3() }, groundY: 0, waterY: 0, floorX: NaN, floorZ: NaN, floorY: 0, floorWorld: null, seated: false, heldPose: null,
    lod: createLodEntry(), mixerT: 0, casting: null, fx: createFxState(),
  };
}

/** The floor under (x, z): the walk world's top, the water's line below it where it's wet. Kept until they move 2 cm. */
function floorUnder(r: RemoteRig, world: GroundWorld, x: number, z: number): number {
  if (r.floorWorld !== world || Math.abs(x - r.floorX) > 0.02 || Math.abs(z - r.floorZ) > 0.02) {
    r.floorWorld = world; r.floorX = x; r.floorZ = z;
    const top = world.top(x, z);
    r.waterY = top;
    r.floorY = world.wet(x, z) ? top - WATER_DROP : top;
  }
  return r.floorY;
}

/**
 * How near you (world units, on the ground) a Full player's held item, weapon or tool casts its sun shadow
 * (specs/perf/effects-cost.md: each part of it was another draw in the shadow map on every Full player); 1 u of
 * hysteresis past it. Their body's shadow is untouched.
 */
export const HELD_SHADOW_RANGE = 10;
/** Whether a remote's held item casts this frame (module scope; `r.lod.dist` is this frame's). */
export function itemShadow(r: RemoteRig): boolean {
  return r.lod.tier === FULL && r.lod.dist < HELD_SHADOW_RANGE + (r.motion.itemShadow ? 1 : 0);
}

/** Called for each movement-juice event (Full tier only); `i` is its slot in the sample's events. */
export type JuiceSink = (r: RemoteRig, e: RemoteEvent, i: number) => void;

/**
 * Sample the remote at room time `now` and write its anchor and motion for this frame. One-shots: a clip (`play`,
 * `upper`) on any drawn tier, an afterimage and the juice at Full only; Hidden plays none (they'd play late on coming
 * back), but its state keeps up so it reappears in the right pose.
 */
export function driveRig(r: RemoteRig, now: number, world: GroundWorld, juice: JuiceSink | null,
  /** Development (the effect bench, benchFx.ts): rewrites the sample before it is used. */
  place?: ((s: RemoteSample) => void) | null): RemoteSample {
  const s = FX_BENCH ? benchSample(r, now) : r.entry.sample(now, r.sample), m = r.motion, tier = r.lod.tier;
  if (FX_BENCH && place) place(s);
  const groundY = world.room ? s.y : Math.min(s.y, floorUnder(r, world, s.x, s.z));
  r.groundY = groundY;
  r.feet.current.set(s.x, s.y, s.z);
  r.anchor.current?.position.set(s.x, groundY, s.z);
  const pose = knownClip(s.pose) ? s.pose : null, seated = pose !== null && SEAT_CLIPS.has(pose);
  r.seated = seated;
  // A held clip (a seat, a fish hold) is asserted every frame; it's let go of only when the sender lets go of it, so a
  // looping emote Character turned into a pose (a Dance one-shot) keeps playing until they move.
  if (pose) m.pose = pose;
  else if (r.heldPose) m.pose = null;
  r.heldPose = pose;
  m.yaw = s.yaw;
  m.move = seated ? null : s.move;
  m.speed = seated || (s.move !== null && !GROUND_MOVES.has(s.move)) ? 0 : Math.hypot(s.vx, s.vz);
  m.air = s.air;
  m.leaf = !FX_BENCH || fxOn("leaf") ? s.leaf : 0;
  m.lift = seated ? s.lift : s.y - groundY;
  for (let i = 0; i < s.eventCount; i++) {
    const e = s.events[i];
    switch (e.kind) {
      case "play": if (tier !== HIDDEN && knownClip(e.value) && (!FX_BENCH || fxOn("emotes") || !isEmoteClip(e.value))) { if (seated) m.upper = e.value; else m.play = e.value; } break;
      case "upper": if (tier !== HIDDEN && knownClip(e.value)) m.upper = e.value; break;
      case "ghost": if (tier === FULL && (!FX_BENCH || fxOn("ghost"))) m.ghost = true; break;
      case "stop": m.stop = true; break;
      default: if (tier === FULL && juice) juice(r, e, i);
    }
  }
  return s;
}

/**
 * Whether Character steps this rig's mixer this frame, and by how much; the anchor shows on every drawn tier. `dt` is
 * the frame's delta as Character takes it (min(delta, 0.1)): its step is dt × rate, so a rate of saved-up / dt steps
 * the saved-up time at once.
 */
export function gateMixer(r: RemoteRig, dt: number): void {
  const tier = r.lod.tier, m = r.motion, a = r.anchor.current, shown = tier !== HIDDEN;
  if (a && a.visible !== shown) a.visible = shown;
  r.dust.current = tier === FULL && (!FX_BENCH || fxOn("dust")) ? m : null;
  if (!shown) { r.live.current = null; r.mixerT = 0; return; }
  // Full, and anyone with the leaf open: HeldLeaf places the leaf from the motion every frame (null hides it).
  if (tier === FULL || (m.leaf ?? 0) > 0.01) { m.rate = 1; r.live.current = m; r.mixerT = 0; return; }
  r.mixerT += dt;
  if (r.mixerT < 1 / LOD.reducedHz) { r.live.current = null; return; }
  m.rate = dt > 0 ? Math.min(r.mixerT, 0.2) / dt : 1;
  r.live.current = m;
  r.mixerT = 0;
}

/**
 * Development (the effect bench): the interpolated sample, or with `interp` off the last one held still (no events),
 * so the bench can price the interpolation itself.
 */
const sampled = new WeakSet<RemoteRig>();
function benchSample(r: RemoteRig, now: number): RemoteSample {
  if (fxOn("interp") || !sampled.has(r)) { sampled.add(r); return r.entry.sample(now, r.sample); }
  r.sample.eventCount = 0; r.sample.snapped = false;
  return r.sample;
}

let castOn = false;
function castVisit(o: THREE.Object3D) {
  const mesh = o as THREE.Mesh;
  if (!mesh.isMesh) return;
  const u = mesh.userData;
  if (castOn) {
    if (!u.netCaster) return;
    delete u.netCaster;
    u.sunCaster = "dynamic";
    mesh.castShadow = true;
  } else if (u.sunCaster === "dynamic") {
    // Remembered, so only what cast before casts again at Full.
    u.netCaster = true;
    u.sunCaster = "off";
    mesh.castShadow = false;
  }
}
/**
 * The sun shadow on or off for everything a remote draws (its body, what it holds, the leaf). SunShadows takes
 * `userData.sunCaster` before `castShadow`, and "off" is neither of its sets, so both are written; things mounted
 * later (a tool coming out) are caught by the next call.
 */
export function castSunShadows(root: THREE.Object3D, on: boolean): void {
  castOn = on;
  root.traverse(castVisit);
}
