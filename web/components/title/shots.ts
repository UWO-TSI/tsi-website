import type { Village } from "@/lib/game/villageMap";
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
 * own subject. Staged on the live island (hq at (0, 9.35) facing the east shore, wharf at (8, -19.5)); when terrain
 * v2 replaces it these get restaged for the fishing village (specs/terrain-v2.md, migration checklist).
 */
const SHOTS: Record<IslandPhase, Shot> = {
  /** The east beach: open sea with the sun's glint path, the wharf and the boat's pennant off right, sky for the wordmark. */
  dawn: { x: 1, z: -12, yaw: 170, eye: 1.8, pitch: -2.5, fov: 44 },
  /** The village avenue: the red carpet up to the HQ and its flag, the oracle temple peeking far right, residents passing. */
  day: { x: 0, z: -14, yaw: 0, eye: 2.4, pitch: -3, fov: 36 },
  /** Golden hour on the HQ in three-quarter view: lit windows, long shadows across the plaza, the lamp by the wordmark. */
  evening: { x: 2, z: -6.5, yaw: 3, eye: 1.8, pitch: -2.5, fov: 38 },
  /** The lantern glowing over the plaza, warm HQ windows, fireflies by the bushes; a tighter drift keeps the pool of light. */
  night: { x: 2.5, z: -7.5, yaw: 6, eye: 1.8, pitch: -2, fov: 38, drift: 0.8 },
};

const SEASON_SHOTS: Partial<Record<Season, Partial<Record<IslandPhase, Shot>>>> = {};

/** The staged shot for now, or a safe meadow fallback on a repainted island that moved the ground from under it. */
export function stagedShot(phase: IslandPhase, season: Season, v: Village, island: VillageIsland): Shot {
  const shot = SEASON_SHOTS[season]?.[phase] ?? SHOTS[phase];
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
