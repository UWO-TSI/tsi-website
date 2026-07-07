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

const DURATION_MS = 520;
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
  // Juice round 2: a second, slightly delayed ring + a center dot that
  // pops and fades — the click reads as a confident "there".
  const mesh2Ref = useRef<THREE.Mesh>(null);
  const mat2Ref = useRef<THREE.MeshBasicMaterial>(null);
  const dotRef = useRef<THREE.Mesh>(null);
  const dotMatRef = useRef<THREE.MeshBasicMaterial>(null);
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
    // Second ring trails 140ms behind the first.
    const t2 = Math.min(Math.max((elapsedRef.current - 140) / DURATION_MS, 0), 1);
    if (mesh2Ref.current) {
      const s2 = t2 * MAX_SCALE * 0.75;
      mesh2Ref.current.scale.set(s2, s2, s2);
    }
    if (mat2Ref.current) {
      mat2Ref.current.opacity = t2 > 0 ? (1 - t2) * 0.8 : 0;
    }
    // Center dot: quick pop (overshoot) then fade.
    if (dotRef.current && dotMatRef.current) {
      const dp = Math.min(elapsedRef.current / 180, 1);
      const pop = dp < 1 ? 0.55 + Math.sin(dp * Math.PI) * 0.45 : 0.55;
      dotRef.current.scale.set(pop, pop, pop);
      dotMatRef.current.opacity = 1 - t;
    }
    if (t >= 1 && t2 >= 1) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={[x, groundY, z]}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0, 0, 0]}>
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
      <mesh ref={mesh2Ref} rotation={[-Math.PI / 2, 0, 0]} scale={[0, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[INNER_RADIUS, OUTER_RADIUS, 32]} />
        <meshBasicMaterial
          ref={mat2Ref}
          color="#FFFFFF"
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={dotRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.16, 16]} />
        <meshBasicMaterial
          ref={dotMatRef}
          color={ACCENT_COLOR}
          transparent
          opacity={1}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
