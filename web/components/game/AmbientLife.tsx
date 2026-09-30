"use client";

import { Suspense, useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { GLBProp } from "./NatureModels";
import { fireflyOffset } from "@/lib/game/fireflyPath";
import { worldTime } from "@/lib/game/worldClock";

// Seeded PRNG so per-mount values are deterministic.
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Fireflies (night only, 8-12) ───────────────────────────────
function Firefly({ seed, anchor, groundHeight }: { seed: number; anchor?: readonly [number, number]; groundHeight: (x: number, z: number) => number }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const glow = useTexture("/assets/sky/sun.png");

  const { home, phase, drift } = useMemo(() => {
    const rng = seededRandom(seed * 1013 + 17);
    return {
      home: anchor ? new THREE.Vector3(anchor[0], 0, anchor[1]) : new THREE.Vector3((rng() - 0.5) * 50, 0, (rng() - 0.5) * 50),
      phase: rng() * Math.PI * 2,
      drift: anchor ? 0.65 + rng() * 0.4 : 1.8 + rng() * 1.6,
    };
  }, [seed, anchor]);

  useFrame(() => {
    if (!ref.current) return;
    const t = worldTime();
    const offset = fireflyOffset(seed, t);
    const x = home.x + offset[0] * drift;
    const z = home.z + offset[2] * drift;
    const y = groundHeight(x, z) + offset[1];
    const dx = x - ref.current.position.x, dz = z - ref.current.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.0001) ref.current.rotation.y = Math.atan2(dx, dz);
    ref.current.position.set(x, y, z);
    // Pulse glow.
    if (matRef.current) {
      matRef.current.opacity = 0.34 + Math.sin(t * (1.1 + drift * 0.3) + phase) * 0.24;
    }
  });

  return (
    <group ref={ref} position={[home.x, 1.0, home.z]}>
      <GLBProp url="/assets/acnh/critters/firefly.glb" scale={0.012} rotation={[-Math.PI / 2, 0, 0]} />
      <sprite scale={[0.13, 0.13, 1]}>
        <spriteMaterial ref={matRef} map={glow} color="#ffec8b" transparent opacity={0.5} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

export function Fireflies({ count, anchors, groundHeight }: { count: number; anchors: readonly (readonly [number, number])[]; groundHeight: (x: number, z: number) => number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <Suspense key={i} fallback={null}><Firefly seed={i + 1} anchor={anchors.length ? anchors[i % anchors.length] : undefined} groundHeight={groundHeight} /></Suspense>
      ))}
    </group>
  );
}
