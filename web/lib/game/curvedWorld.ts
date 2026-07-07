"use client";

/**
 * Curved-world horizon bend (cozy push V1) — the ACNH signature.
 *
 * Patches three.js's shared `project_vertex` shader chunk so every built-in
 * material (Standard/Basic/Lambert/etc., instanced meshes included) sinks
 * geometry by view-distance squared: the village rolls away over a hill
 * exactly like Animal Crossing's cylindrical world. Reference math:
 * Aitchison's classic curved-world parabola, applied in view space.
 *
 * Deliberately NOT applied to custom ShaderMaterials (sky dome, river) —
 * the sky must stay put, and the near-center river shows no visible seam at
 * this strength. Shadow depth passes stay unbent too; at 0.0012 the offset
 * at shadow distances is sub-pixel.
 *
 * Import once (side effect) before the Canvas mounts — GameWorld does this.
 * Must run before the first material compiles; three caches programs per
 * material, so patching later would only affect new materials.
 */

import * as THREE from "three";

// Bend strength: drop = z² · BEND (view-space units). At the fog far edge
// (~70u) that's ~9.8u of sink — a clearly readable ACNH horizon roll that
// still keeps the playable ±30u gentle (30u → ~1.8u). 0.0012 read as too
// subtle in the 2026-07-04 screenshot pass.
export const WORLD_BEND = 0.0026;

const MARKER = "// tsi-curved-world";

if (typeof window !== "undefined") {
  const chunk = THREE.ShaderChunk.project_vertex;
  if (!chunk.includes(MARKER)) {
    THREE.ShaderChunk.project_vertex = chunk.replace(
      "gl_Position = projectionMatrix * mvPosition;",
      `${MARKER}
mvPosition.y -= mvPosition.z * mvPosition.z * ${WORLD_BEND.toFixed(6)};
gl_Position = projectionMatrix * mvPosition;`
    );
  }
}
