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

// Bend strength: drop = z² · BEND + x² · SIDE (view-space units). The z
// term is the ACNH roll-away; the x term (David ask, 2026-07-08) rounds
// the horizon off at the SIDES too, so the world reads like a little
// planet instead of a cylinder. Side term kept ~1/3 strength — at ±20u
// lateral it sinks 0.44u, just enough to bow the skyline.
export const WORLD_BEND = 0.0032;
export const WORLD_BEND_SIDE = 0.0011;

const MARKER = "// tsi-curved-world";

if (typeof window !== "undefined") {
  // Aerial survey loads (?aerial=1, collab track) compile a FLAT world —
  // the curvature is constant-baked into every program, and from 140u up
  // it warps the map into a fisheye. Product loads are untouched: the
  // param is read once at module init, before any material compiles.
  const aerialSurvey = new URLSearchParams(window.location.search).get("aerial") === "1";
  const bend = aerialSurvey ? 0 : WORLD_BEND;
  const bendSide = aerialSurvey ? 0 : WORLD_BEND_SIDE;
  const chunk = THREE.ShaderChunk.project_vertex;
  if (!chunk.includes(MARKER)) {
    THREE.ShaderChunk.project_vertex = chunk.replace(
      "gl_Position = projectionMatrix * mvPosition;",
      `${MARKER}
mvPosition.y -= mvPosition.z * mvPosition.z * ${bend.toFixed(6)} + mvPosition.x * mvPosition.x * ${bendSide.toFixed(6)};
gl_Position = projectionMatrix * mvPosition;`
    );
  }
}
