/**
 * The water field on the CPU, exactly as the water shader samples it (components/game/grid/terrainMaterials.ts
 * setShoreField writes both): the seabed's depth under the still surface (the field's green channel, half floats,
 * read bilinearly with the edge clamped) and the waves' calm (its own small grid, lib/game/seabed.ts bakeWaveCalm,
 * bytes). What floats on the water (lib/game/wharf.ts) reads the waves through it, so a boat rides the surface the
 * GPU draws.
 */
import type { WaveField } from "./waves";

/** A grid over a world rect, sampled at texel centres like a LINEAR, CLAMP_TO_EDGE texture. */
export interface FieldGrid { data: Float32Array; width: number; height: number; minX: number; minZ: number; sizeX: number; sizeZ: number }

let depthGrid: FieldGrid | null = null;
let calmGrid: FieldGrid | null = null;

/** Hand the CPU the field the shader now has (null: none, the open deep sea everywhere). */
export function mirrorWaterField(depth: FieldGrid | null, calm: FieldGrid | null): void {
  depthGrid = depth;
  calmGrid = calm;
}
/** The depth grid the CPU holds (the editor patches rows of it in place with the texture). */
export const mirroredDepth = () => depthGrid;

/** A grid read as the GPU reads its texture: bilinear between texel centres, the coordinate clamped to the edge texels. */
export function sampleGrid(g: FieldGrid, x: number, z: number): number {
  const fx = Math.min(g.width - 1, Math.max(0, ((x - g.minX) / g.sizeX) * g.width - 0.5));
  const fz = Math.min(g.height - 1, Math.max(0, ((z - g.minZ) / g.sizeZ) * g.height - 0.5));
  const x0 = Math.floor(fx), z0 = Math.floor(fz), x1 = Math.min(g.width - 1, x0 + 1), z1 = Math.min(g.height - 1, z0 + 1);
  const tx = fx - x0, tz = fz - z0, d = g.data, w = g.width;
  const top = d[z0 * w + x0] + (d[z0 * w + x1] - d[z0 * w + x0]) * tx;
  const bottom = d[z1 * w + x0] + (d[z1 * w + x1] - d[z1 * w + x0]) * tx;
  return top + (bottom - top) * tz;
}

/** The field at world (x, z): `depth` the bed under the still surface (deep with no field), `calm` (1 with none). */
export function waterFieldAt(x: number, z: number, out: WaveField): WaveField {
  out.depth = depthGrid ? sampleGrid(depthGrid, x, z) : 1e3;
  out.calm = calmGrid ? sampleGrid(calmGrid, x, z) : 1;
  return out;
}
