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
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.scale.setScalar(0.16); // baked here: parent-group transforms can be
    return c;                // dropped by R3F HMR re-parenting (2026-07-13)
  }, [scene]);
  const y = getTerrainHeight(34, -33);
  const beaconRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const b = beaconRef.current;
    if (!b) return;
    // slow beacon breath — reads as the lamp turning without a spot cone
    b.intensity = 8 + Math.sin(performance.now() / 640) * 5;
  });
  return (
    <group position={[34, y, -33]} rotation={[0, Math.PI / 4, 0]}>
      <primitive object={clone} scale={[0.16, 0.16, 0.16]} />
      <pointLight ref={beaconRef} color="#FFE9A8" intensity={8} distance={13} decay={1.8} position={[0, 5.2, 0]} />
    </group>
  );
}

function Windmill() {
  const { scene } = useGLTF(WINDMILL_URL);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.scale.setScalar(0.14);
    c.position.set(-30, getTerrainHeight(-30, 22), 22);
    c.rotation.y = Math.PI / 3;
    return c;
  }, [scene]);
  // Static piece: blade spin needs a sub-node split in the extraction —
  // logged as a nice-to-have.
  return <primitive object={clone} />;
}

export default function Landmarks() {
  return (
    <Suspense fallback={null}>
      <Lighthouse />
      <Windmill />
    </Suspense>
  );
}
