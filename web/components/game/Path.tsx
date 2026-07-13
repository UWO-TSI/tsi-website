"use client";

/**
 * Curved dirt-path mesh with alpha-blended edges.
 *
 * Sprint A2 (2026-05-21). Replaces the previous straight rectangular path
 * quads in GameWorld.tsx with Catmull-Rom splines that bend gently and fade
 * smoothly into the surrounding grass. Spec: sprint-2026-05-game-look-feel.md §A2
 * + ux-game-world-v2.md §4.2.
 *
 * Geometry: sample N points along a Catmull-Rom curve fitted to the supplied
 * XZ control points. For each sample emit three rows of vertices
 * (left edge, center spine, right edge) offset perpendicular to the curve
 * direction by -halfW, 0, +halfW. Triangulate as a strip.
 *
 * Each vertex's Y is sampled from the terrain plus a small yOffset so the
 * ribbon hugs the ground (the underlying PATH_CORRIDORS in terrain.ts
 * already flatten these zones to y≈0 along the length, so terrain height is
 * small and the ribbon stays close to y=0).
 *
 * Soft edges: vertex alpha is 0 at the two edge rows and 1.0 at the center
 * spine. The 4-component color attribute carries RGBA; we patch the
 * meshBasicMaterial shader via onBeforeCompile so the alpha component
 * actually modulates output (Three.js's built-in vertexColors only reads
 * RGB). Material is transparent + depthWrite:false + polygonOffset so the
 * fade renders cleanly without z-fighting the terrain underneath.
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";

interface PathProps {
  /** Control points in world-space XZ pairs. Spline interpolates through all of them. */
  controlPoints: [number, number][];
  /** Total path width (cross-axis). Default 2.5 matches v2 spec §4.2. */
  width?: number;
  /** Center color of the path. Edges fade to alpha=0 with this same color. */
  color?: string;
  /** Number of length segments along the curve. Higher = smoother bends. */
  segments?: number;
  /** Small y-offset baked into vertices to prevent z-fighting with the terrain. */
  yOffset?: number;
}

const DEFAULT_COLOR = "#C4A265"; // v2 spec §3.2 "Dirt path"
// W3: 5 cross-rows (was 3) so the edge feathers with a smoothstep ramp
// instead of a hard linear V — reads painted-in against the triangle grass.
const ROWS = 5;

export default function Path({
  controlPoints,
  width = 2.7,
  color = DEFAULT_COLOR,
  segments = 48,
  yOffset = 0.02,
}: PathProps) {
  const geometry = useMemo(() => {
    const points3 = controlPoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(points3, false, "catmullrom", 0.5);

    const sampleCount = segments + 1;
    const baseColor = new THREE.Color(color);

    const positions = new Float32Array(sampleCount * ROWS * 3);
    const colors = new Float32Array(sampleCount * ROWS * 4);
    const indices: number[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const t = i / segments;
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);

      // Perpendicular in the XZ plane: rotate tangent 90° around Y.
      // (tx, 0, tz) → (-tz, 0, tx).
      const px = -tangent.z;
      const pz = tangent.x;
      const plen = Math.hypot(px, pz) || 1;
      const nx = px / plen;
      const nz = pz / plen;

      for (let r = 0; r < ROWS; r++) {
        const u = r / (ROWS - 1); // 0 … 1 across width
        const offset = (u - 0.5) * width;
        const vx = point.x + nx * offset;
        const vz = point.z + nz * offset;
        const vy = getTerrainHeight(vx, vz) + yOffset;

        const idx = i * ROWS + r;
        positions[idx * 3] = vx;
        positions[idx * 3 + 1] = vy;
        positions[idx * 3 + 2] = vz;

        // W3: smoothstep feather. Solid core across the middle ~55% of the
        // width, softly fading to alpha 0 at both edges.
        const edge = Math.abs(u - 0.5) * 2; // 0 center → 1 edge
        const s = THREE.MathUtils.clamp((edge - 0.45) / 0.55, 0, 1);
        const alpha = 1 - s * s * (3 - 2 * s); // 1 core → 0 edge
        colors[idx * 4] = baseColor.r;
        colors[idx * 4 + 1] = baseColor.g;
        colors[idx * 4 + 2] = baseColor.b;
        colors[idx * 4 + 3] = alpha;
      }

      if (i > 0) {
        for (let r = 0; r < ROWS - 1; r++) {
          const a0 = (i - 1) * ROWS + r;
          const a1 = (i - 1) * ROWS + r + 1;
          const b0 = i * ROWS + r;
          const b1 = i * ROWS + r + 1;
          indices.push(a0, b0, b1);
          indices.push(a0, b1, a1);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    // Use a custom attribute name (not "color") to avoid clashing with
    // Three.js's built-in `attribute vec3 color` that ships with USE_COLOR.
    geo.setAttribute("pathColor", new THREE.BufferAttribute(colors, 4));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [controlPoints, width, color, segments, yOffset]);

  // Material: meshBasicMaterial patched via onBeforeCompile so a custom
  // vec4 "pathColor" attribute drives both RGB tint and alpha falloff.
  // We don't enable Three's vertexColors flag (which only reads RGB) — the
  // shader patch is the entire vertex-color pipeline for this mesh.
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "void main() {",
          "attribute vec4 pathColor;\nvarying vec4 vPathColor;\nvoid main() {\n  vPathColor = pathColor;",
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          "varying vec4 vPathColor;\nvoid main() {",
        )
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.rgb *= vPathColor.rgb;\ndiffuseColor.a *= vPathColor.a;",
        );
    };

    return mat;
  }, []);

  // P4 memory: dispose the BufferGeometry + Material on unmount.
  // React doesn't auto-dispose Three resources; without this, leaving
  // and re-entering the scene leaks GPU memory.
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // renderOrder -2: ground-level transparents must draw before every other
  // transparent (player sprite, leaves, FX). Mesh-center distance sorting
  // put whole path ribbons after the player and painted over their feet.
  return <mesh geometry={geometry} material={material} receiveShadow renderOrder={-2} />;
}
