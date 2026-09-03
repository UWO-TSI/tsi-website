"use client";

/**
 * MiniSignpost — a wooden post with one arrow plank aimed at a target
 * and a readable label. Same recipe as the member island's Signpost
 * (GameWorld.tsx), trimmed to a single arm.
 */

import { Html } from "@react-three/drei";

export default function MiniSignpost({
  position,
  target,
  label,
}: {
  position: [number, number, number];
  target: [number, number];
  label: string;
}) {
  const yaw = Math.atan2(target[0] - position[0], target[1] - position[2]);
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 1.8, 8]} />
        <meshStandardMaterial color="#8B6B4A" roughness={0.95} />
      </mesh>
      <group position={[0, 1.45, 0]} rotation={[0, yaw, 0]}>
        <mesh position={[0, 0, 0.32]} castShadow>
          <boxGeometry args={[0.16, 0.34, 0.9]} />
          <meshStandardMaterial color="#C9A66B" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0, 0.9]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.24, 0.34, 4]} />
          <meshStandardMaterial color="#C9A66B" roughness={0.9} />
        </mesh>
      </group>
      <Html zIndexRange={[40, 0]} position={[0, 2.15, 0]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
        <div
          style={{
            fontSize: 12,
            color: "#2a2a2a",
            background: "rgba(255,255,255,0.9)",
            padding: "3px 9px",
            borderRadius: 6,
            fontWeight: 600,
            fontFamily: "'IBM Plex Mono', monospace",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}
