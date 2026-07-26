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

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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

// Palm sway (wake 67): a gentle breeze roll around the trunk base —
// different phase per palm so the islet reads alive, not metronomic.
function SwayPalm({ url, position, rotY, scale, phase }: {
  url: string; position: [number, number, number]; rotY: number; scale: number; phase: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.rotation.z = Math.sin(t * 0.55 + phase) * 0.022 + Math.sin(t * 1.7 + phase * 2) * 0.006;
  });
  return (
    <group ref={ref} position={position}>
      <GLBProp url={url} position={[0, 0, 0]} rotation={[0, rotY, 0]} scale={scale} />
    </group>
  );
}

// Crab scuttle (wake 63): one little red crab side-stepping arcs of the
// sand ring — skitter bursts with freeze pauses, ACNH beach-crab energy.
function IsletCrab() {
  const ref = useRef<THREE.Group>(null);
  const st = useRef({ a: 0.8, dir: 1, moving: true, nextFlipAt: 3 });
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    const s = st.current;
    if (t > s.nextFlipAt) {
      s.moving = !s.moving;
      if (s.moving && Math.random() < 0.45) s.dir *= -1;
      s.nextFlipAt = t + (s.moving ? 1.2 + Math.random() * 1.8 : 0.7 + Math.random() * 1.1);
    }
    if (s.moving) s.a += s.dir * dt * 0.32;
    const r = 5.4;
    const x = CX + Math.cos(s.a) * r;
    const z = CZ + Math.sin(s.a) * r;
    const skitter = s.moving ? Math.sin(t * 26) * 0.02 : 0;
    g.position.set(x + skitter, -0.015 + (s.moving ? Math.abs(Math.sin(t * 18)) * 0.015 : 0), z);
    // crabs face ALONG the radius while walking sideways around the arc
    g.rotation.y = Math.atan2(x - CX, z - CZ);
  });
  return (
    <group ref={ref}>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.09, 8, 6]} />
        <meshStandardMaterial color="#D25438" roughness={0.85} />
      </mesh>
      {/* claws */}
      <mesh position={[-0.09, 0.06, 0.06]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#E06844" roughness={0.85} />
      </mesh>
      <mesh position={[0.09, 0.06, 0.06]}>
        <sphereGeometry args={[0.035, 6, 5]} />
        <meshStandardMaterial color="#E06844" roughness={0.85} />
      </mesh>
      {/* eye stalks */}
      <mesh position={[-0.03, 0.12, 0.04]}>
        <sphereGeometry args={[0.016, 5, 4]} />
        <meshStandardMaterial color="#3A2A22" roughness={0.7} />
      </mesh>
      <mesh position={[0.03, 0.12, 0.04]}>
        <sphereGeometry args={[0.016, 5, 4]} />
        <meshStandardMaterial color="#3A2A22" roughness={0.7} />
      </mesh>
    </group>
  );
}

export default function IslaChica() {
  return (
    <group>
      <IsletCrab />
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

      {/* palms frame the back rim (breeze-swayed); rocks anchor the far edge */}
      <SwayPalm url={PALM_A} position={[CX - 3.2, -0.02, CZ + 2.6]} rotY={0.7} scale={1.0} phase={0} />
      <SwayPalm url={PALM_A} position={[CX + 2.9, -0.02, CZ + 3.1]} rotY={3.4} scale={0.9} phase={2.2} />
      <SwayPalm url={PALM_B} position={[CX - 1.1, -0.02, CZ - 3.6]} rotY={5.1} scale={0.95} phase={4.1} />
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
      {/* driftwood log seat (wake 67) — sit spot at [-26.5, 70.5] in BENCHES */}
      <group position={[-26.5, 0.14, 70.5]} rotation={[0, -0.7, Math.PI / 2]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.19, 1.9, 8]} />
          <meshStandardMaterial color="#A08B6E" roughness={0.95} flatShading />
        </mesh>
      </group>
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
