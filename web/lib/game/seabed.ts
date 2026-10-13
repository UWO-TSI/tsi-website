/**
 * The seabed under the island's water (v1 water pass, specs/v1-drop.md §8c.1): how far below the still surface it
 * lies at any point. ONE function for the bed mesh (components/game/grid/GridTerrain.tsx) and for the bake the water's
 * colour reads (the water field's depth channel, terrainMaterials.ts setShoreField), so the shallows are always the
 * shade of the sand you can see under them: depth comes from the known seabed, with no depth pass.
 */
import { Surface, coastDistance, overlayAt, sampleShore, smoothstep, type IslandMap, type ShoreSdf } from "./grid";
import { bedDepth, type WaterParams } from "./waterShader";
import { TUNING_DEFAULTS } from "./tuning";

/** How far the bed drops below a grass bank's water at once: the river channel's edge. */
export const BANK_DIP = 0.12;

type BedParams = Pick<WaterParams, "bedDepth" | "bedSlope" | "shelfDepth" | "shelfFrom" | "shelfTo">;

/**
 * World units from the still water's surface down to the bed at world (x, z). The bed under a beach starts AT the
 * waterline and carries the sand's slope on down (a grass bank keeps its 0.12 channel edge). Near the coast the
 * distance is the coast field's own (smooth, so the sand and the bed meet without a step); past a cell the shore
 * field takes over, and past the shallows the drop-off to the open sea (`bedDepth`).
 *
 * Reads the SHIPPED tuning by default, not the live bench value: this is geometry.
 */
export function seabedDip(map: IslandMap, shore: ShoreSdf, x: number, z: number, p: BedParams = TUNING_DEFAULTS.water): number {
  const far = sampleShore(shore, x, z), k = smoothstep(0.6, 1.2, far);
  const d = k >= 1 ? far : -coastDistance(map, x, z) * (1 - k) + far * k;
  const bed = bedDepth(d, p);
  // The bank's dip only ever matters where the bed is still shallower than it.
  return bed >= BANK_DIP ? bed : Math.max(BANK_DIP * (1 - overlayAt(map, Surface.Sand, x, z)), bed);
}

/**
 * The seabed's depth at each sample of the shore field (its centres, its layout): 0 on land, `seabedDip` over water.
 * The water shader reads it bilinearly from the field's second channel.
 */
export function bakeWaterDepth(map: IslandMap, shore: ShoreSdf, p: BedParams = TUNING_DEFAULTS.water): Float32Array {
  const out = new Float32Array(shore.data.length);
  for (let j = 0; j < shore.height; j++) {
    const z = shore.minZ + (j + 0.5) / shore.scale;
    for (let i = 0; i < shore.width; i++) {
      const k = j * shore.width + i, r = shore.data[k];
      if (r <= 0) continue;
      // Past the coast's own reach the dip is the profile of the field's distance alone (no lattice lookups).
      out[k] = r >= 1.2 ? Math.max(bedDepth(r, p), 1e-4) : Math.max(seabedDip(map, shore, shore.minX + (i + 0.5) / shore.scale, z, p), 1e-4);
    }
  }
  return out;
}

/** The deepest the seabed gets anywhere (the open sea past the drop-off): where the open sea's own floor lies. */
export const deepestSeabed = (p: BedParams = TUNING_DEFAULTS.water) => bedDepth(1e4, p);
