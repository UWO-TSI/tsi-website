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
 * this strength.
 *
 * ⚠️ THE "SHADOW DEPTH PASSES STAY UNBENT" CLAIM BELOW IS FALSE (verified
 * 2026-07-26). It was the original rationale and it does not hold:
 *
 *   - three r182 `ShaderLib/depth.glsl.js:37` includes <project_vertex>, so
 *     patching the SHARED chunk bends the shadow caster too — in the LIGHT's
 *     view space, which is a completely different bend from the camera's.
 *   - The receiver disagrees. `meshphysical.glsl.js` runs project_vertex at
 *     line 44 and worldpos_vertex at line 50, and worldpos_vertex.glsl.js
 *     builds `vec4 worldPosition = vec4(transformed, 1.0)` — the UNBENT
 *     position. shadowmap_vertex then derives vDirectionalShadowCoord from
 *     that. So the lookup coordinate is unbent while the stored depth came
 *     from bent geometry.
 *   - Magnitude is not sub-pixel. Displacement is
 *     `lightViewZ² * 0.0032 + lightViewX² * 0.0011` and the sun rig sits 30u
 *     out (GameWorld updateShadowRig), so casters land several units off in
 *     the shadow map, by an amount that grows quadratically with distance
 *     from the shadow camera centre. The rig follows the player, so the error
 *     CHANGES AS YOU WALK: shadows slide relative to their objects.
 *   - The "0.0012" in the original note also predates WORLD_BEND being raised
 *     to 0.0032.
 *
 * FIXED 2026-07-26 (D1) by guarding the patch so it no-ops for the depth and
 * distance materials — see the SHADOW_PASS_DEFINE block below. Casters and
 * receivers now agree on the unbent world.
 *
 * Still open, and deliberately deferred: bending in WORLD space relative to
 * the player instead of view space. That is camera-independent and also
 * removes the screen-edge fisheye that the wide FOV amplifies, so it belongs
 * with the M8 camera pass (FOV 48 -> ~30), not here.
 *
 * Note also that ACNH bakes contact shadows into the assets as `mShadow`
 * meshes (see scripts/organize-dump.mjs). Restoring those removes the need
 * for the realtime shadow map entirely, which by the project's own
 * measurement costs ~7 FPS on M1. See specs/acnh-system-reference.md §4.
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

// D1 fix (2026-07-26): the shadow passes must NOT bend.
//
// project_vertex is shared with the depth and distance shaders, so the bend
// was being applied in the LIGHT's view space while receivers looked their
// shadows up with the unbent world position (worldpos_vertex uses
// `transformed`). Casters landed several units off in the shadow map, by an
// amount that grew quadratically and changed as the player walked.
//
// MeshDistanceMaterial already self-declares DISTANCE on line 2 of its vertex
// shader. MeshDepthMaterial has no distinguishing define in the VERTEX stage —
// three only emits DEPTH_PACKING into the fragment prefix (WebGLProgram.js:778,
// inside prefixFragment) — so we stamp our own onto ShaderLib.depth, which is
// what WebGLPrograms maps MeshDepthMaterial to (WebGLPrograms.js:23).
const SHADOW_PASS_DEFINE = "TSI_SHADOW_PASS";

if (typeof window !== "undefined") {
  // Aerial survey loads (?aerial=1, collab track) compile a FLAT world —
  // the curvature is constant-baked into every program, and from 140u up
  // it warps the map into a fisheye. Product loads are untouched: the
  // param is read once at module init, before any material compiles.
  const aerialSurvey = new URLSearchParams(window.location.search).get("aerial") === "1";
  const bend = aerialSurvey ? 0 : WORLD_BEND;
  const bendSide = aerialSurvey ? 0 : WORLD_BEND_SIDE;

  // Mark the depth pass. Must happen before the first material compiles;
  // three caches programs, so a later patch would only affect new materials.
  const depthShader = THREE.ShaderLib.depth;
  if (depthShader && !depthShader.vertexShader.includes(SHADOW_PASS_DEFINE)) {
    depthShader.vertexShader = `#define ${SHADOW_PASS_DEFINE}\n${depthShader.vertexShader}`;
  }

  const chunk = THREE.ShaderChunk.project_vertex;
  if (!chunk.includes(MARKER)) {
    THREE.ShaderChunk.project_vertex = chunk.replace(
      "gl_Position = projectionMatrix * mvPosition;",
      `${MARKER}
#if !defined( ${SHADOW_PASS_DEFINE} ) && !defined( DISTANCE )
mvPosition.y -= mvPosition.z * mvPosition.z * ${bend.toFixed(6)} + mvPosition.x * mvPosition.x * ${bendSide.toFixed(6)};
#endif
gl_Position = projectionMatrix * mvPosition;`
    );
  }
}
