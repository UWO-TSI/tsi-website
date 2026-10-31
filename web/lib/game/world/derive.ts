/**
 * What the smooth world derives from its terrain before anyone walks it: the cell map's natural shapes (lib/game/grid.ts
 * `terrainOf`: the coast, the beach, the overlays; 1.5 s on an M4) and the water's shore field (`terrainShoreField`,
 * 0.3 s). The game runs each in its own worker, side by side, while the loading screen is up (deriveWorker.ts,
 * lib/game/world/load.ts) and seeds the caches with the result, so the main thread never freezes on it. Same code
 * either side: byte-identical.
 */
import { terrainOf, type Terrain } from "../grid";
import { cellMapOf, terrainShoreField, type WorldTerrain } from "./terrain";

export interface DerivedWorld { terrain: Terrain; shore: ReturnType<typeof terrainShoreField> }

export type DerivePart = keyof DerivedWorld;

/** One of the two derivations (a worker each). */
export function derivePart(t: WorldTerrain, part: DerivePart): Partial<DerivedWorld> {
  return part === "terrain" ? { terrain: terrainOf(cellMapOf(t)) } : { shore: terrainShoreField(t) };
}

export function deriveWorld(t: WorldTerrain): DerivedWorld {
  return { ...derivePart(t, "terrain"), ...derivePart(t, "shore") } as DerivedWorld;
}

/** Every buffer in a derived world (or part of one), once each: handed over to the main thread rather than copied. */
export function derivedBuffers({ terrain, shore }: Partial<DerivedWorld>): ArrayBuffer[] {
  const arrays = [...(terrain ? [terrain.coast, terrain.beach, terrain.built, ...terrain.overlays.values(), ...Object.values(terrain.scratch)] : []), ...(shore ? [shore.data, shore.depth] : [])];
  return [...new Set(arrays.map(a => a.buffer as ArrayBuffer))];
}
