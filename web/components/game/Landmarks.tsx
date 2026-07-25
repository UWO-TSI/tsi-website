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
import { coastDist, rimSink } from "@/lib/game/coast";

const LIGHTHOUSE_URL = "/assets/acnh/furniture/lighthouse.glb";
const WINDMILL_TOWER_URL = "/assets/acnh/props/windmill-tower.glb";
const WINDMILL_BLADES_URL = "/assets/acnh/props/windmill-blades.glb";
useGLTF.preload(LIGHTHOUSE_URL);
useGLTF.preload(WINDMILL_TOWER_URL);
useGLTF.preload(WINDMILL_BLADES_URL);

function Lighthouse() {
  const { scene } = useGLTF(LIGHTHOUSE_URL);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.scale.setScalar(0.16); // baked here: parent-group transforms can be
    return c;                // dropped by R3F HMR re-parenting (2026-07-13)
  }, [scene]);
  // Organic coast v2: pulled to (32.6, -31.6) — the old spot drowned when
  // the harmonics grew. Sits on the beach band; rim sink keeps it planted.
  const y = getTerrainHeight(38.2, -37.1) - rimSink(coastDist(38.2, -37.1));
  const beaconRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const b = beaconRef.current;
    if (!b) return;
    // slow beacon breath — reads as the lamp turning without a spot cone
    b.intensity = 8 + Math.sin(performance.now() / 640) * 5;
  });
  return (
    <group position={[38.2, y, -37.1]} rotation={[0, Math.PI / 4, 0]}>
      <primitive object={clone} scale={[0.16, 0.16, 0.16]} />
      <pointLight ref={beaconRef} color="#FFE9A8" intensity={8} distance={13} decay={1.8} position={[0, 5.2, 0]} />
    </group>
  );
}

function Windmill() {
  // Blade split (loop, David's pick 2026-07-14): the merged mesh was cut
  // by rotor-plane predicate (split_windmill.mjs) into tower + blades,
  // blades recentered on the hub (raw y 27.31, z 5.81) so rotation.z
  // spins them in place. Lazy 0.6 rad/s — a farm windmill turning.
  const tower = useGLTF(WINDMILL_TOWER_URL);
  const blades = useGLTF(WINDMILL_BLADES_URL);
  const bladesRef = useRef<THREE.Group>(null);
  const towerClone = useMemo(() => tower.scene.clone(true), [tower.scene]);
  const bladesClone = useMemo(() => blades.scene.clone(true), [blades.scene]);
  useFrame((_, delta) => {
    if (bladesRef.current) bladesRef.current.rotation.z += delta * 0.6;
  });
  return (
    <group position={[-30, getTerrainHeight(-30, 22), 22]} rotation={[0, Math.PI / 3, 0]} scale={[0.14, 0.14, 0.14]}>
      <primitive object={towerClone} />
      <group ref={bladesRef} position={[0, 27.31, 5.81]}>
        <primitive object={bladesClone} />
      </group>
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
