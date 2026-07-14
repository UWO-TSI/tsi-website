"use client";

/**
 * ShoreLife (2026-07-13) — buoys and Kapp'n's boat riding the swell just
 * past the shoreline (gentle seeded bob + tilt — the only animated
 * transforms, all refs). The plaza campfire lives in AmbientProps (it
 * predates this file; a duplicate briefly shipped here — removed).
 */

import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const BUOY_URL = "/assets/acnh/props/buoy.glb";
const BOAT_URL = "/assets/acnh/props/boat.glb";
useGLTF.preload(BUOY_URL);
useGLTF.preload(BOAT_URL);

const BUOYS: { x: number; z: number; phase: number }[] = [
  { x: -38, z: -46, phase: 0.0 },
  { x: 52, z: -34, phase: 2.1 },
  { x: 10, z: 60, phase: 4.2 },
];
const OCEAN_Y = -0.55;

function Buoy({ x, z, groupRef }: { x: number; z: number; groupRef: (el: THREE.Group | null) => void }) {
  const { scene } = useGLTF(BUOY_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return (
    <group ref={groupRef} position={[x, OCEAN_Y, z]}>
      <primitive object={clone} scale={[0.1, 0.1, 0.1]} />
    </group>
  );
}

function Boat({ groupRef }: { groupRef: (el: THREE.Group | null) => void }) {
  const { scene } = useGLTF(BOAT_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return (
    <group ref={groupRef} position={[45, OCEAN_Y - 0.1, -44]} rotation={[0, -Math.PI / 3, 0]}>
      <primitive object={clone} scale={[0.1, 0.1, 0.1]} />
    </group>
  );
}

export default function ShoreLife() {
  const buoyRefs = useRef<(THREE.Group | null)[]>([]);
  const boatRef = useRef<THREE.Group | null>(null);

  useFrame(() => {
    const t = performance.now() / 1000;
    BUOYS.forEach((b, i) => {
      const g = buoyRefs.current[i];
      if (!g) return;
      g.position.y = OCEAN_Y + Math.sin(t * 0.9 + b.phase) * 0.12;
      g.rotation.x = Math.sin(t * 0.7 + b.phase) * 0.07;
      g.rotation.z = Math.cos(t * 0.55 + b.phase * 1.3) * 0.07;
    });
    const boat = boatRef.current;
    if (boat) {
      boat.position.y = OCEAN_Y - 0.1 + Math.sin(t * 0.55 + 1.2) * 0.09;
      boat.rotation.z = Math.sin(t * 0.42) * 0.035;
      boat.rotation.x = Math.cos(t * 0.35 + 0.7) * 0.028;
    }
  });

  return (
    <Suspense fallback={null}>
      {BUOYS.map((b, i) => (
        <Buoy key={i} x={b.x} z={b.z} groupRef={(el) => { buoyRefs.current[i] = el; }} />
      ))}
      <Boat groupRef={(el) => { boatRef.current = el; }} />
    </Suspense>
  );
}
