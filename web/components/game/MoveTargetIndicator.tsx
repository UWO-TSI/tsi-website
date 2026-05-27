"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";

/**
 * MoveTargetIndicator — expanding ring sprite that fades out at a click-to-move
 * destination. Mounted by PlayerAvatar when a target is set; self-destructs by
 * calling onComplete after DURATION_MS.
 *
 * Sprint A8 deliverable #5.
 */

const DURATION_MS = 400;
const MAX_SCALE = 1.5;
const ACCENT_COLOR = "#FFD166";
const INNER_RADIUS = 0.5;
const OUTER_RADIUS = 0.6;

interface MoveTargetIndicatorProps {
  position: [number, number, number];
  onComplete: () => void;
}

export default function MoveTargetIndicator({ position, onComplete }: MoveTargetIndicatorProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const elapsedRef = useRef(0);
  const doneRef = useRef(false);

  const [x, , z] = position;
  const groundY = getTerrainHeight(x, z) + 0.05;

  useFrame((_, delta) => {
    if (doneRef.current) return;
    elapsedRef.current += delta * 1000;
    const t = Math.min(elapsedRef.current / DURATION_MS, 1);
    if (meshRef.current) {
      const scale = t * MAX_SCALE;
      meshRef.current.scale.set(scale, scale, scale);
    }
    if (matRef.current) {
      matRef.current.opacity = 1 - t;
    }
    if (t >= 1) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[x, groundY, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[0, 0, 0]}
    >
      <ringGeometry args={[INNER_RADIUS, OUTER_RADIUS, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color={ACCENT_COLOR}
        transparent
        opacity={1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
