"use client";

/**
 * PlazaHedges (loop wake 39, flag-list item "hedge/park fences") — ACNH
 * FenceIkegaki hedge runs framing the plaza's south edge, split around the
 * north-south path. Skinned model (like the dump fish): SkeletonUtils clone
 * or the segments ignore their placement transforms entirely.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { getTerrainHeight } from "./terrain";
import { AudioManager } from "@/lib/game/audio";

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

export default function PlazaHedges({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const { scene } = useGLTF(HEDGE_URL);
  // Brush-past rustle (loop wake 40): walking close makes the segment
  // shiver for ~0.45s with a leaf scuff — per-segment cooldown so a slow
  // stroll along the run reads as a wave of rustles, not a rattle.
  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const rustleAt = useRef<number[]>(SEGMENTS.map(() => -Infinity));
  useFrame(() => {
    const p = playerPosRef.current;
    const now = performance.now();
    for (let i = 0; i < SEGMENTS.length; i++) {
      const g = groupRefs.current[i];
      if (!g) continue;
      const [x, , z] = [SEGMENTS[i][0], 0, SEGMENTS[i][1]];
      const d = Math.hypot(p.x - x, p.z - z);
      const since = (now - rustleAt.current[i]) / 1000;
      if (d < 1.05 && since > 1.2) {
        rustleAt.current[i] = now;
        AudioManager.playSFX("footstep"); // leaf-scuff proxy
      }
      if (since < 0.45) {
        const decay = 1 - since / 0.45;
        g.rotation.z = Math.sin(since * 34) * 0.05 * decay;
      } else if (g.rotation.z !== 0) {
        g.rotation.z = 0;
      }
    }
  });
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
        <group
          key={i}
          position={[x, getTerrainHeight(x, z), z]}
          rotation-y={ry}
          scale={0.1}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
        >
          <primitive object={clones[i]} />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(HEDGE_URL);
