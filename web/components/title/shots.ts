import { objectById, type Village } from "@/lib/game/villageMap";
import type { VillageIsland } from "@/lib/game/defaultIsland";
import type { IslandPhase } from "@/lib/game/islandTime";
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
  /** Early light down the street from the plaza's far side: the HQ small at the end, sky for the wordmark. */
  dawn: { x: 1, z: -21.35, yaw: -5, eye: 1.4, pitch: -2, fov: 44 },
  /**
   * The v1 look (specs/v1-drop.md §8b, after title-piece-by-piece-ref.png): low in the lawn, close, the grass soft in
   * front, the HQ and its flag sharp in the middle, the trees soft beyond; residents pass on the avenue.
   */
  day: { x: 3, z: -16.75, yaw: -8, eye: 0.9, pitch: -0.5, fov: 38 },
  /** Golden hour on the HQ in three-quarter view from the lawn: lit windows, long shadows, the lamp by the wordmark. */
  evening: { x: 3.2, z: -16.15, yaw: -12, eye: 0.95, pitch: -0.5, fov: 40 },
  /** The lantern glowing over the plaza, warm HQ windows, fireflies by the bushes; a tighter drift keeps the pool of light. */
  night: { x: 2.5, z: -16.85, yaw: 6, eye: 1.2, pitch: -1.5, fov: 40, drift: 0.8 },
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
