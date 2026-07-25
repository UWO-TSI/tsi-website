"use client";

/**
 * IslaChica (GEO S5, 2026-07-25) — the boat-only islet off the SSW coast.
 *
 * A small self-contained island mesh floating on the Ocean plane, fully
 * outside the main coast field: the baked terrain grid reads 0 out here,
 * so the walk surface sits flush at y≈0 and the player strolls it with no
 * terrain changes. Walkability comes from the islet halo in
 * lib/game/coast.ts clampToCoast; travel is the rowboat pair (mainland
 * beach ↔ islet landing) wired as exterior stations in GameWorld.
 *
 * Dressing stays ACNH-restrained: three palms, a rock pair, shells, the
 * rowboats, and a two-plank landing. The far shore hosts a sea cast spot.
 */

import { useGLTF } from "@react-three/drei";
import { GLBProp } from "./NatureModels";

export const ISLET_CENTER: [number, number] = [-24, 72];
/** Radial walk limit around ISLET_CENTER (see clampToCoast). */
export const ISLET_WALK_R = 5.6;

const PALM_A = "/assets/acnh/plants/tree-palm-a.glb";
const PALM_B = "/assets/acnh/plants/tree-palm-b.glb";
const BOAT = "/assets/acnh/props/boat.glb";
const ROCK_B = "/assets/acnh/props/rock-b.glb";
const ROCK_D = "/assets/acnh/props/rock-d.glb";
const SHELL_SCALLOP = "/assets/acnh/props/shell-scallop.glb";
const SHELL_WHELK = "/assets/acnh/props/shell-whelk.glb";
[PALM_A, PALM_B, BOAT, ROCK_B, ROCK_D, SHELL_SCALLOP, SHELL_WHELK].forEach((u) => useGLTF.preload(u));

const [CX, CZ] = ISLET_CENTER;
// Mainland dock: half-beached rowboat on the SSW sand (inside the walk
// clamp — legacy coast dist ≈46 here). GameWorld's BOAT_TRIPS reference
// these two spots; keep them in sync.
export const MAINLAND_BOAT: [number, number] = [-13, 52.5];
// Islet landing faces the mainland (direction +x/-z from center).
const LANDING: [number, number] = [CX + 2.0, CZ - 5.9];

export default function IslaChica() {
  return (
    <group>
      {/* island body: sand skirt diving under the ocean + flat walk pads */}
      <mesh position={[CX, -0.59, CZ]}>
        <cylinderGeometry args={[6.5, 8.4, 1.1, 40]} />
        <meshStandardMaterial color="#D8BE8A" roughness={0.95} />
      </mesh>
      <mesh position={[CX, -0.035, CZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6.5, 40]} />
        <meshStandardMaterial color="#E8D5A4" roughness={0.95} />
      </mesh>
      <mesh position={[CX - 0.4, -0.012, CZ + 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[4.3, 36]} />
        <meshStandardMaterial color="#6FBF5A" roughness={0.92} />
      </mesh>

      {/* palms frame the back rim; rocks anchor the far edge */}
      <GLBProp url={PALM_A} position={[CX - 3.2, -0.02, CZ + 2.6]} rotation={[0, 0.7, 0]} scale={1.0} />
      <GLBProp url={PALM_A} position={[CX + 2.9, -0.02, CZ + 3.1]} rotation={[0, 3.4, 0]} scale={0.9} />
      <GLBProp url={PALM_B} position={[CX - 1.1, -0.02, CZ - 3.6]} rotation={[0, 5.1, 0]} scale={0.95} />
      <GLBProp url={ROCK_B} position={[CX - 4.6, -0.03, CZ - 1.4]} rotation={[0, 1.9, 0]} scale={1.1} castShadow={false} />
      <GLBProp url={ROCK_D} position={[CX + 4.3, -0.03, CZ + 0.9]} rotation={[0, 0.4, 0]} scale={0.85} castShadow={false} />
      <GLBProp url={SHELL_SCALLOP} position={[CX + 0.8, -0.02, CZ - 4.9]} rotation={[0, 2.2, 0]} scale={0.9} castShadow={false} />
      <GLBProp url={SHELL_WHELK} position={[CX - 3.9, -0.02, CZ + 4.4]} rotation={[0, 4.0, 0]} scale={0.9} castShadow={false} />

      {/* landing: two weathered planks stepping down to the islet boat */}
      <mesh position={[LANDING[0], -0.06, LANDING[1]]} rotation={[0, -0.32, 0]}>
        <boxGeometry args={[0.9, 0.07, 2.0]} />
        <meshStandardMaterial color="#A98B62" roughness={0.9} />
      </mesh>
      <mesh position={[LANDING[0] + 0.4, -0.16, LANDING[1] - 1.7]} rotation={[0, -0.32, 0]}>
        <boxGeometry args={[0.9, 0.07, 1.6]} />
        <meshStandardMaterial color="#9C7F58" roughness={0.9} />
      </mesh>

      {/* mainland put-in: a small sand apron under the beached boat (the
          shader's sand band starts past the walk clamp at this angle, so
          the launch gets its own pad) */}
      <mesh position={[MAINLAND_BOAT[0] + 0.3, 0.015, MAINLAND_BOAT[1] + 0.9]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.6, 26]} />
        <meshStandardMaterial color="#E2CFA0" roughness={0.95} />
      </mesh>
      {/* the rowboat pair — islet side floats off the landing, mainland
          side sits half-beached on the SSW sand */}
      {/* boat.glb is a 20x39u model — 0.06 reads as a village rowboat */}
      <GLBProp url={BOAT} position={[LANDING[0] + 1.1, -0.5, LANDING[1] - 3.1]} rotation={[0, 2.85, 0]} scale={0.06} />
      <GLBProp url={BOAT} position={[MAINLAND_BOAT[0] + 0.6, -0.38, MAINLAND_BOAT[1] + 1.6]} rotation={[0, -0.5, 0]} scale={0.06} />
      {/* mooring posts */}
      <mesh position={[LANDING[0] - 0.5, 0.16, LANDING[1] - 2.6]}>
        <cylinderGeometry args={[0.09, 0.11, 0.66, 8]} />
        <meshStandardMaterial color="#8A6E4C" roughness={0.9} />
      </mesh>
      <mesh position={[MAINLAND_BOAT[0] - 0.9, 0.2, MAINLAND_BOAT[1] + 0.7]}>
        <cylinderGeometry args={[0.09, 0.11, 0.7, 8]} />
        <meshStandardMaterial color="#8A6E4C" roughness={0.9} />
      </mesh>
    </group>
  );
}
