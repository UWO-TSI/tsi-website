"use client";

/**
 * Cosmetic family aura (row 206): a few glowing motes drifting around the
 * player in the family colour. Reuses the firefly system's path
 * (fireflyPath.ts) and glow sprite (AmbientLife fireflies).
 */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { fireflyOffset } from "@/lib/game/fireflyPath";

const MOTES = 7;

export default function FamilyAura({ player, color }: { player: React.RefObject<THREE.Vector3>; color: string }) {
  const glow = useTexture("/assets/sky/sun.png");
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, p = player.current;
    for (let i = 0; i < MOTES; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const o = fireflyOffset(i + 41, t * 1.4);
      m.position.set(p.x + o[0] * 0.75, p.y + 0.15 + o[1] * 1.1, p.z + o[2] * 0.75);
      m.material.opacity = 0.7 + Math.sin(t * 2 + i * 1.7) * 0.25;
    }
  });
  return <group>
    {Array.from({ length: MOTES }, (_, i) => <sprite key={i} ref={el => { refs.current[i] = el; }} scale={[0.22, 0.22, 1]}>
      <spriteMaterial map={glow} color={color} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
    </sprite>)}
  </group>;
}
