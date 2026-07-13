/**
 * Live critter registry (critters pillar v1, 2026-07-12).
 *
 * Critters.tsx animates spawns inside the Canvas and mirrors their coarse
 * XZ here every frame; GameWorld's nearest-interactable sweep reads the
 * registry on each player-move tick to offer "Catch ..." on E. Module
 * mutable state, no React subscription — the same lightweight pattern as
 * flowerPicks, but write-heavy/read-cheap instead of the reverse.
 */

export interface ActiveCritter {
  slot: number;
  key: string; // collection item_key, e.g. bug_common_butterfly
  label: string; // "a Common Butterfly"
  x: number;
  z: number;
}

let active: ActiveCritter[] = [];

export function setActiveCritters(list: ActiveCritter[]): void {
  active = list;
}

export function getActiveCritters(): readonly ActiveCritter[] {
  return active;
}

/** yyyymmdd day key for deterministic daily spawns (kept here so component
 * render scopes never touch Date directly — react-compiler purity). */
export function todayCritterSeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
