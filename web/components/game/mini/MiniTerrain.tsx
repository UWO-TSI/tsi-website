"use client";

/**
 * MiniTerrain — the applicant island's ground. A vertex-colored plane:
 * flat grass quilt inside GRASS_RADIUS, a dry-then-wet sand ring, and a
 * rim that sinks under the water plane (see lib/game/miniIsland.ts).
 * Same grass family as the member island (P.grassPrimary) so the two
 * worlds read as one place.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { valueNoise } from "../terrain";
import { GRASS_RADIUS, miniHeight } from "@/lib/game/miniIsland";

const SIZE = 60;
const SEGMENTS = 96;

const GRASS = new THREE.Color("#8CBA5E");
const GRASS_DARK = new THREE.Color("#7FAC50");
const GRASS_LIGHT = new THREE.Color("#A3CC74");
const SAND = new THREE.Color("#E7D3A0");
const WET_SAND = new THREE.Color("#C9B282");

export default function MiniTerrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, miniHeight(x, z));
      const r = Math.hypot(x, z);
      // Grass quilt: two noise octaves pick between three greens.
      const n = valueNoise(x * 0.35, z * 0.35) * 0.65 + valueNoise(x * 1.1, z * 1.1) * 0.35;
      if (n < 0.42) c.copy(GRASS_DARK);
      else if (n > 0.66) c.copy(GRASS_LIGHT);
      else c.copy(GRASS);
      if (r > GRASS_RADIUS - 0.6) {
        const t = THREE.MathUtils.smoothstep(r, GRASS_RADIUS - 0.6, GRASS_RADIUS + 0.4);
        c.lerp(SAND, t);
      }
      if (r > GRASS_RADIUS + 1.2) {
        const t = THREE.MathUtils.smoothstep(r, GRASS_RADIUS + 1.2, GRASS_RADIUS + 2.4);
        c.lerp(WET_SAND, t);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} />
    </mesh>
  );
}
