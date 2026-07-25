"use client";

/**
 * WharfPier (GEO S3, 2026-07-25) — a fixed-height plank pier jutting north
 * off the wharf apron over the carved river channel, ending at the pier-tip
 * fishing spot. RoadTiles can't decking over water (tiles follow terrain
 * into the carve), so this is a small static mesh: planks + posts sunk to
 * the channel bed. Walk support lives in terrain.ts (flat 0.12 override).
 */

import * as THREE from "three";

const X0 = 43.2;
const X1 = 45.2;
const Z0 = 0.4;
const Z1 = 5.0;
const DECK_Y = 0.1;

const PLANKS: { z: number }[] = [];
for (let z = Z0 + 0.25; z < Z1; z += 0.5) PLANKS.push({ z });

const POSTS: [number, number][] = [
  [X0 + 0.15, Z0 + 0.3],
  [X1 - 0.15, Z0 + 0.3],
  [X0 + 0.15, (Z0 + Z1) / 2],
  [X1 - 0.15, (Z0 + Z1) / 2],
  [X0 + 0.15, Z1 - 0.2],
  [X1 - 0.15, Z1 - 0.2],
];

export default function WharfPier() {
  return (
    <group>
      {PLANKS.map((p, i) => (
        <mesh key={i} position={[(X0 + X1) / 2, DECK_Y, p.z]} castShadow receiveShadow>
          <boxGeometry args={[X1 - X0, 0.06, 0.42]} />
          <meshStandardMaterial color={i % 3 === 0 ? "#A87C50" : "#B5885C"} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      {POSTS.map(([x, z], i) => (
        <mesh key={`p${i}`} position={[x, -0.55, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 1.5, 8]} />
          <meshStandardMaterial color="#7A5A3A" roughness={0.92} metalness={0} />
        </mesh>
      ))}
      {/* end rail so the tip reads as a casting perch */}
      <mesh position={[(X0 + X1) / 2, 0.42, Z1 - 0.06]} castShadow>
        <boxGeometry args={[X1 - X0, 0.07, 0.09]} />
        <meshStandardMaterial color="#7A5A3A" roughness={0.9} metalness={0} />
      </mesh>
      {[X0 + 0.12, X1 - 0.12].map((x, i) => (
        <mesh key={`r${i}`} position={[x, 0.26, Z1 - 0.06]} castShadow>
          <cylinderGeometry args={[0.045, 0.05, 0.34, 6]} />
          <meshStandardMaterial color="#7A5A3A" roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
