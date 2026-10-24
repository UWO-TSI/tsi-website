/**
 * The ground height for the few callers that don't hold the world (FlowerPickFX): whatever the mounted world says.
 * GridWorld and SmoothTerrain register the provider while mounted; with none mounted the ground is 0.
 *
 * A registered provider rather than an import, so this file knows nothing about the grid or the world. (The radial
 * FBM island that answered here before the grid, "the wrong model" in David's 2026-07-26 ruling, is gone.)
 */
let heightProvider: ((x: number, z: number) => number) | null = null;

export function setTerrainHeightProvider(fn: ((x: number, z: number) => number) | null): void {
  heightProvider = fn;
}

export function getTerrainHeight(x: number, z: number): number {
  return heightProvider ? heightProvider(x, z) : 0;
}
