"use client";

/**
 * IdleFireflies (loop iter 5, David ask 2026-07-24): stand still for ~3s
 * and a soft ring of glowing fireflies gathers around you. They anchor to
 * WHERE you stopped — walk off and they stay behind, fading out, never
 * following. Cozy idle flair; all refs, zero per-frame React.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 6;
const SHOW_AFTER = 3; // s of stillness
const RADIUS = 0.9;

export default function IdleFireflies({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const groupRef = useRef<THREE.Group>(null);
  const anchorRef = useRef(new THREE.Vector3(0, 0, 0));
  const idleRef = useRef(0);
  const glowRef = useRef(0); // 0..1 visibility lerp
  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const p = playerPosRef.current;
    const moved = anchorRef.current.distanceToSquared(p) > 0.36;
    if (moved) {
      // Player left: fireflies stay at the old anchor and fade.
      idleRef.current = 0;
      glowRef.current = Math.max(0, glowRef.current - dt * 1.6);
      if (glowRef.current === 0) anchorRef.current.copy(p);
    } else {
      idleRef.current += dt;
      if (idleRef.current > SHOW_AFTER) glowRef.current = Math.min(1, glowRef.current + dt * 0.8);
    }
    g.visible = glowRef.current > 0.01;
    if (!g.visible) return;
    const t = performance.now() / 1000;
    const a = anchorRef.current;
    for (let i = 0; i < COUNT; i++) {
      const child = g.children[i];
      if (!child) continue;
      const ph = (i / COUNT) * Math.PI * 2;
      child.position.set(
        a.x + Math.cos(t * 0.5 + ph) * (RADIUS + Math.sin(t * 0.9 + ph * 2) * 0.2),
        a.y + 0.9 + Math.sin(t * 1.3 + ph * 3) * 0.35,
        a.z + Math.sin(t * 0.5 + ph) * (RADIUS + Math.cos(t * 0.7 + ph) * 0.2)
      );
      const m = matRefs.current[i];
      if (m) m.emissiveIntensity = glowRef.current * (1.2 + Math.sin(t * 2.2 + ph * 5) * 0.7);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {Array.from({ length: COUNT }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.035, 6, 5]} />
          <meshStandardMaterial
            ref={(m) => { matRefs.current[i] = m; }}
            color="#FFF3B0"
            emissive="#FFE28A"
            emissiveIntensity={0}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}
