/**
 * The rain's puddles (the map's puddle spots, drawn as ellipses while it rains: IslandAtmosphere), for whatever
 * steps in them (specs/polish/forage-craft-museum.md 5): every footstep, the player's and each resident's, splashes
 * where it lands in one (lib/game/movement/juice.ts footstep). Module state, written when the weather or the map
 * changes, read per step without allocating.
 */
export interface PuddleSpot { x: number; z: number; rx: number; rz: number }
let spots: readonly PuddleSpot[] = [];
/** The puddles out now (none when it isn't raining). */
export function setPuddles(list: readonly PuddleSpot[]) { spots = list; }
/** Whether (x, z) is in one of them. */
export function puddleAt(x: number, z: number): boolean {
  for (let i = 0; i < spots.length; i++) {
    const p = spots[i], u = (x - p.x) / p.rx, v = (z - p.z) / p.rz;
    if (u * u + v * v < 1) return true;
  }
  return false;
}
