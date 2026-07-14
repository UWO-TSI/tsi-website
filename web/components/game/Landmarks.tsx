"use client";

/**
 * Landmarks (2026-07-13) — wayfinding anchors from Furniture/: a red-and-
 * white lighthouse on the southeast shore and a retro windmill on the
 * northwest field. Big silhouettes readable from across the island; the
 * windmill blades spin lazily (one ref rotation — the only animation).
 */

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";

const LIGHTHOUSE_URL = "/assets/acnh/furniture/lighthouse.glb";
const WINDMILL_URL = "/assets/acnh/furniture/windmill-retro.glb";
useGLTF.preload(LIGHTHOUSE_URL);
useGLTF.preload(WINDMILL_URL);

function Lighthouse() {
  const { scene } = useGLTF(LIGHTHOUSE_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const y = getTerrainHeight(34, -33);
  const beaconRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const b = beaconRef.current;
    if (!b) return;
    // slow beacon breath — reads as the lamp turning without a spot cone
    b.intensity = 10 + Math.sin(performance.now() / 640) * 7;
  });
  return (
    <group position={[34, y, -33]} rotation={[0, Math.PI / 4, 0]}>
      <primitive object={clone} scale={[0.16, 0.16, 0.16]} />
      <pointLight ref={beaconRef} color="#FFE9A8" intensity={10} distance={26} decay={1.6} position={[0, 5.2, 0]} />
    </group>
  );
}

function Windmill() {
  const { scene } = useGLTF(WINDMILL_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const y = getTerrainHeight(-30, 22);
  // Static piece: blade spin needs a sub-node split in the extraction —
  // logged as a nice-to-have.
  return (
    <group position={[-30, y, 22]} rotation={[0, Math.PI / 3, 0]} scale={[0.14, 0.14, 0.14]}>
      <primitive object={clone} />
    </group>
  );
}

export default function Landmarks() {
  return (
    <Suspense fallback={null}>
      <Lighthouse />
      <Windmill />
    </Suspense>
  );
}
