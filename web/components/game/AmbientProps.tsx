"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getTerrainHeight } from "./terrain";
import { sampleRiverPoint, findRiverTForX } from "./River";

/**
 * Sprint A5 — ambient scatter props.
 *
 * ~20 small environmental pieces to break up empty space:
 *   - 4 signposts near building approaches (arrow planks rotated toward target)
 *   - 6 stepping stones across the river at a narrow bend (perpendicular to tangent)
 *   - 4 short picket-fence sections around the courtyard perimeter
 *   - 4 lanterns by each building door (emissive panes + subtle point light)
 *
 * Procedural primitives only — no GLB loading, no new deps. All ground-touching
 * meshes sample `getTerrainHeight` so they sit flush on the rolling hills from A1.
 * Stepping stones use the River spline's tangent so they line up with the actual
 * water flow rather than a hardcoded angle.
 */

// ─── Palette (subset of GameWorld's P, kept inline to avoid an export) ──
const C = {
  postDark: "#5A4A3A",
  plankWarm: "#8B6F4E",
  stone: "#7A7A7A",
  fence: "#6B5A3F",
  lanternPost: "#3D2817",
  lanternBody: "#5A4A3A",
  lanternGlow: "#FFD080",
  lanternEmissive: "#FFA040",
};

// ─── Signposts ──────────────────────────────────────────────────────────
// Each entry: post position [x, z] and the building it points to [x, z].
// Arrow plank rotates around Y so its long axis points at the target.
const SIGNPOSTS: { pos: [number, number]; target: [number, number] }[] = [
  { pos: [0, -8], target: [0, -4] },     // south approach to HQ
  { pos: [-8, 8], target: [-14, 8] },    // east approach to Shop
  { pos: [0, 17], target: [0, 22] },     // south approach to Oracle Temple
  { pos: [-1.5, -13], target: [0, -4] }, // spawn area pointing to HQ
];

function Signpost({ pos, target }: { pos: [number, number]; target: [number, number] }) {
  const [x, z] = pos;
  const y = getTerrainHeight(x, z);
  const heading = Math.atan2(target[0] - x, target[1] - z);
  return (
    <group position={[x, y, z]} rotation={[0, heading, 0]}>
      <mesh position={[0, 0.7, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.1, 1.4, 8]} />
        <meshStandardMaterial color={C.postDark} roughness={0.92} metalness={0} />
      </mesh>
      {/* Arrow plank — long axis (X) points toward target after the parent rotation. */}
      <mesh position={[0.45, 1.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.25, 0.05]} />
        <meshStandardMaterial color={C.plankWarm} roughness={0.88} metalness={0} />
      </mesh>
    </group>
  );
}

// ─── Stepping stones ────────────────────────────────────────────────────
// Lay 6 stones perpendicular to the river tangent at a narrow downstream bend.
// Picking t≈0.78 (somewhere past control point [16, 2]) avoids the bridge at x=0.
function SteppingStones() {
  const stones = useMemo(() => {
    const t = findRiverTForX(11);
    const { position, tangent } = sampleRiverPoint(t);
    // Perpendicular to tangent in XZ plane = (-tangent.z, tangent.x).
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const out: { x: number; z: number }[] = [];
    const spacing = 1.5;
    for (let i = 0; i < 6; i++) {
      const offset = (i - 2.5) * spacing;
      // Slight arc: nudge along tangent based on |offset| so the row gently bows.
      const arc = Math.abs(offset) * 0.08;
      out.push({
        x: position.x + normal.x * offset + tangent.x * arc,
        z: position.z + normal.z * offset + tangent.z * arc,
      });
    }
    return out;
  }, []);

  return (
    <group>
      {stones.map((s, i) => (
        <mesh key={i} position={[s.x, 0.05, s.z]} castShadow receiveShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.2, 12]} />
          <meshStandardMaterial color={C.stone} roughness={0.95} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Picket fence section ───────────────────────────────────────────────
// 2 posts, 2 rails, 5 pickets. Section length ≈ 2 units along local X.
function FenceSection({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const pickets = [-0.8, -0.4, 0, 0.4, 0.8];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* End posts */}
      {[-1, 1].map((side) => (
        <mesh key={`post-${side}`} position={[side, 0.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.0, 8]} />
          <meshStandardMaterial color={C.fence} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      {/* Horizontal rails */}
      {[0.25, 0.75].map((ry, i) => (
        <mesh key={`rail-${i}`} position={[0, ry, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.06, 0.06]} />
          <meshStandardMaterial color={C.fence} roughness={0.9} metalness={0} />
        </mesh>
      ))}
      {/* Pickets */}
      {pickets.map((px) => (
        <mesh key={`pk-${px}`} position={[px, 0.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.7, 0.04]} />
          <meshStandardMaterial color={C.fence} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

// 4 perimeter sections: south, north-west, east, north-east. Chosen to sit
// outside the main building cluster but well inside the 40-unit island.
const FENCES: { pos: [number, number]; rot: number }[] = [
  { pos: [-18, -18], rot: 0 },
  { pos: [18, -18], rot: 0 },
  { pos: [-20, 18], rot: Math.PI / 2 },
  { pos: [20, 18], rot: Math.PI / 2 },
];

// ─── Lantern ────────────────────────────────────────────────────────────
function Lantern({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Post */}
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.07, 1.6, 8]} />
        <meshStandardMaterial color={C.lanternPost} roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Lantern body */}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.4, 0.3]} />
        <meshStandardMaterial color={C.lanternBody} roughness={0.8} metalness={0} />
      </mesh>
      {/* Emissive panes on each of the 4 sides */}
      {[
        { p: [0, 1.8, 0.151] as [number, number, number], r: [0, 0, 0] as [number, number, number] },
        { p: [0, 1.8, -0.151] as [number, number, number], r: [0, Math.PI, 0] as [number, number, number] },
        { p: [0.151, 1.8, 0] as [number, number, number], r: [0, Math.PI / 2, 0] as [number, number, number] },
        { p: [-0.151, 1.8, 0] as [number, number, number], r: [0, -Math.PI / 2, 0] as [number, number, number] },
      ].map((pane, i) => (
        <mesh key={i} position={pane.p} rotation={pane.r}>
          <planeGeometry args={[0.15, 0.25]} />
          <meshStandardMaterial
            color={C.lanternGlow}
            emissive={C.lanternEmissive}
            emissiveIntensity={1.2}
            roughness={0.4}
            metalness={0}
          />
        </mesh>
      ))}
      <pointLight color={C.lanternEmissive} intensity={0.4} distance={5} position={[0, 1.8, 0]} />
    </group>
  );
}

// Lantern XZ positions (offset slightly off each building's door).
const LANTERNS: [number, number][] = [
  [2.5, -7],    // HQ door (south face)
  [-11.5, 8],   // Shop door (east face)
  [2.5, 19],    // Oracle Temple entrance (south face)
  [1.5, -13.5], // spawn area
];

// ─── Root ───────────────────────────────────────────────────────────────
export default function AmbientProps() {
  return (
    <group>
      <group name="signposts">
        {SIGNPOSTS.map((s, i) => (
          <Signpost key={i} pos={s.pos} target={s.target} />
        ))}
      </group>

      <group name="stepping-stones">
        <SteppingStones />
      </group>

      <group name="fences">
        {FENCES.map((f, i) => {
          const y = getTerrainHeight(f.pos[0], f.pos[1]);
          return <FenceSection key={i} position={[f.pos[0], y, f.pos[1]]} rotationY={f.rot} />;
        })}
      </group>

      <group name="lanterns">
        {LANTERNS.map(([x, z], i) => {
          const y = getTerrainHeight(x, z);
          return <Lantern key={i} position={[x, y, z]} />;
        })}
      </group>
    </group>
  );
}
