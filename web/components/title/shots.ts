import * as THREE from "three";
import { objectById, type Village } from "@/lib/game/villageMap";
import type { VillageIsland } from "@/lib/game/defaultIsland";
import type { IslandPhase } from "@/lib/game/islandTime";
import { CurvedCull } from "@/lib/game/curvedCull";
import type { Season } from "@/lib/game/season";

/** One framing: where the camera stands (ground + eye), where it looks (yaw/pitch in degrees) and its lens. */
export type Shot = {
  x: number; z: number; yaw: number; eye: number; pitch: number; fov: number;
  /** How far the slow dolly travels, in units (default 1.6); tighter shots want less. */
  drift?: number;
  /** A shot allowed to stand over water (off-shore looking back at the coast). */
  float?: boolean;
};

/**
 * The staged shots (David, 2026-10-10: "a staged shot with good camera angle... that adjusts and changes based on
 * time and season"): one composition per phase of the world clock, with seasonal overrides where a season earns its
 * own subject. Staged in the HQ's frame (`atHq`: x across its front, z out from its door, scaled with it), so they
 * follow the HQ wherever the member island puts it (row 321: the title moved from the village to the new world).
 */
const SHOTS: Record<IslandPhase, Shot> = {
  /** Early light on the HQ across the plaza's south side: a planter bench and its flowers in front, the flags beside. */
  dawn: { x: -7.65, z: -13.58, yaw: 34.9, eye: 1.3, pitch: -1, fov: 38 },
  /**
   * The v1 look (specs/v1-drop.md §8b, after title-piece-by-piece-ref.png), on the new world: the HQ in three-quarter
   * view right of the menu, its roofline, clock and door clear against the sky, a flag either side, the fountain's edge
   * and a lamp to the left, a planter bench with flowers soft in front.
   */
  day: { x: -7.65, z: -13.58, yaw: 34.9, eye: 1.3, pitch: -1, fov: 38 },
  /** Golden hour on the same view: lit windows, long shadows across the paving. */
  evening: { x: -7.65, z: -13.58, yaw: 34.9, eye: 1.3, pitch: -1, fov: 38 },
  /** The lamps glowing, warm HQ windows; a tighter drift keeps the frame still. */
  night: { x: -7.65, z: -13.58, yaw: 34.9, eye: 1.3, pitch: -1, fov: 38, drift: 0.8 },
};

/** A shot from the HQ's frame onto this island (unchanged where there's no HQ). */
export function atHq(shot: Shot, v: Village): Shot {
  const hq = objectById("landmark", "hq", v);
  if (!hq) return shot;
  const t = hq.yaw ?? 0, k = hq.scale ?? 1, c = Math.cos(t), s = Math.sin(t);
  return { ...shot, x: hq.x + k * (shot.x * c + shot.z * s), z: hq.z + k * (shot.z * c - shot.x * s), yaw: shot.yaw + (t * 180) / Math.PI };
}

const SEASON_SHOTS: Partial<Record<Season, Partial<Record<IslandPhase, Shot>>>> = {};

/** The staged shot for now, or a safe meadow fallback on a repainted island that moved the ground from under it. */
export function stagedShot(phase: IslandPhase, season: Season, v: Village, island: VillageIsland): Shot {
  const shot = atHq(SEASON_SHOTS[season]?.[phase] ?? SHOTS[phase], v);
  if (shot.float || (!island.wet(shot.x, shot.z) && island.standable(shot.x, shot.z))) return shot;
  return fallbackShot(v, island);
}

/** A few steps in from the island's south shore, looking out to sea (the game's camera faces west, +z). */
export function fallbackShot(v: Village, island: VillageIsland): Shot {
  const { cx, cz, maxZ } = v.bounds;
  let shore = cz;
  for (let z = maxZ; z > cz; z -= 0.25) {
    if (!island.wet(cx, z) && island.standable(cx, z)) { shore = z; break; }
  }
  return { x: cx, z: shore - 6, yaw: 0, eye: 1.35, pitch: -3, fov: 52 };
}

/** How far the slow dolly travels when a shot doesn't say (TitleScene). */
export const DRIFT_DISTANCE = 1.2;

/**
 * The title camera `side` units along its dolly (across the view), aimed at yaw/pitch (degrees) and lifted `lift` off
 * its eye height: where it stands (`at`) and a point it looks at (`look`).
 */
export function dollyPose(shot: Shot, side: number, yawDeg: number, pitchDeg: number, lift: number, ground: (x: number, z: number) => number,
  at: THREE.Vector3, look: THREE.Vector3) {
  const yaw = THREE.MathUtils.degToRad(yawDeg), pitch = THREE.MathUtils.degToRad(pitchDeg);
  const x = shot.x + Math.cos(yaw) * side, z = shot.z - Math.sin(yaw) * side;
  at.set(x, ground(x, z) + shot.eye + lift, z);
  look.set(x + Math.sin(yaw) * 10, at.y + Math.tan(pitch) * 10, z + Math.cos(yaw) * 10);
}

const PHASES: readonly IslandPhase[] = ["dawn", "day", "evening", "night"];

/**
 * Whether a world-space sphere can show anywhere in the title's frame: the bent view (lib/game/curvedCull.ts) at nine
 * stops along the dolly of every phase's staged shot and of `shot` (a `?shot=` override), through `camera` at
 * `aspect`. The cull's own margin (1.5 u and about 3 degrees) covers the dolly between stops and the handheld breath.
 */
export function titleView(v: Village, island: VillageIsland, season: Season, shot: Shot, camera: THREE.PerspectiveCamera, aspect: number): (s: THREE.Sphere) => boolean {
  const cam = Object.assign(camera.clone(), { aspect }), at = new THREE.Vector3(), look = new THREE.Vector3(), views: CurvedCull[] = [];
  for (const s of [...PHASES.map(p => stagedShot(p, season, v, island)), shot]) {
    cam.fov = s.fov;
    cam.updateProjectionMatrix();
    for (let k = 0; k <= 8; k++) {
      dollyPose(s, (k / 8 - 0.5) * (s.drift ?? DRIFT_DISTANCE), s.yaw, s.pitch, 0, island.ground, at, look);
      cam.position.copy(at);
      cam.lookAt(look);
      views.push(new CurvedCull().update(cam));
    }
  }
  return sphere => views.some(c => c.visible(sphere));
}
