"use client";

/**
 * PlazaHedges (loop wake 39, flag-list item "hedge/park fences") — ACNH
 * FenceIkegaki hedge runs framing the plaza's south edge, split around the
 * north-south path. Skinned model (like the dump fish): SkeletonUtils clone
 * or the segments ignore their placement transforms entirely.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getTerrainHeight } from "./terrain";

const HEDGE_URL = "/assets/acnh/props/hedge-a.glb";

// x, z, rotY — two runs along the plaza's south boundary (z ≈ -17.5),
// clear of the central path (x ≈ -1.5..1.5) and the west bench.
const SEGMENTS: [number, number, number][] = [
  [-4.8, -17.5, 0],
  [-3.6, -17.5, 0],
  [-2.4, -17.5, 0],
  [2.4, -17.5, 0],
  [3.6, -17.5, 0],
  [4.8, -17.5, 0],
];

export default function PlazaHedges() {
  const { scene } = useGLTF(HEDGE_URL);
  const clones = useMemo(
    () =>
      SEGMENTS.map(() => {
        const c = cloneSkeleton(scene);
        c.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mm of mats) {
            (mm as THREE.MeshStandardMaterial).side = THREE.DoubleSide; // foliage-card lesson
          }
        });
        return c;
      }),
    [scene]
  );
  return (
    <group>
      {SEGMENTS.map(([x, z, ry], i) => (
        <group key={i} position={[x, getTerrainHeight(x, z), z]} rotation-y={ry} scale={0.1}>
          <primitive object={clones[i]} />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(HEDGE_URL);
