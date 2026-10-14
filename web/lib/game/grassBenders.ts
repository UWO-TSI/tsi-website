import type { Object3D } from "three";

/**
 * Who presses the lawn's blades (GrassField): every character registers its lifted group while mounted, so players,
 * residents and remotes all bend the grass, and a hop or a seat lifts them off it.
 */
export const GRASS_BENDERS = new Set<Object3D>();

/** `object`'s world position presses the grass while registered; returns the removal. */
export function addGrassBender(object: Object3D): () => void {
  GRASS_BENDERS.add(object);
  return () => { GRASS_BENDERS.delete(object); };
}
