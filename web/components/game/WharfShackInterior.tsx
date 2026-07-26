"use client";

/**
 * WharfShackInterior (GEO S4 / ECON E3, 2026-07-25) — the fishing store.
 * A snug 8x8 dockside room: counter station opens the SELL sheet (the
 * Shack buys catches for coins 🪙), barrels + crates give it the fish-
 * market read. Gear-for-coins shelf lands with E4.
 * Purpose-first per the collab contract: this room's job is SELLING.
 */

import { Suspense, useEffect, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import {
  InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";

const BOUNDS: RoomBounds = { halfW: 4, halfD: 4, spawn: [0, -2.8] };

export const WHARF_STATIONS: InteriorStation[] = [
  { id: "counter", name: "Sell Catches", pos: [0, 2.2], action: "sheet:wharfsell", range: 2.4 },
  { id: "exit", name: "Exit", pos: [0, -3.5], action: "exit", range: 2.0 },
];

preloadPieces(["counter-register", "barrel", "cardboard-pile", "yellow-message-mat"]);

// The Shack keeper (wake 68) — a procedural fisherman behind the counter:
// straw hat, apron, gentle idle bob, and a friendly lean toward customers
// who step up to sell. First staffed room (principle #2 — never empty).
function WharfKeeper({ playerPosRef }: { playerPosRef: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.position.y = Math.sin(t * 1.6) * 0.03;
    // lean toward the room when the player is at the counter
    const p = playerPosRef.current;
    const near = Math.hypot(p.x - 0, p.z - 2.2) < 2.6;
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, near ? 0.12 : 0, 3, 0.016);
    g.rotation.z = Math.sin(t * 0.9) * 0.02;
  });
  return (
    <group position={[0, 0, 3.35]} rotation={[0, Math.PI, 0]}>
      <group ref={ref}>
        {/* body: apron blue over a warm shirt */}
        <mesh position={[0, 0.52, 0]}>
          <capsuleGeometry args={[0.26, 0.5, 4, 10]} />
          <meshStandardMaterial color="#3E5C7A" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.62, -0.02]}>
          <capsuleGeometry args={[0.235, 0.3, 4, 10]} />
          <meshStandardMaterial color="#C97E5A" roughness={0.9} />
        </mesh>
        {/* head + nose */}
        <mesh position={[0, 1.12, 0]}>
          <sphereGeometry args={[0.21, 12, 10]} />
          <meshStandardMaterial color="#F0C8A0" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.09, 0.2]}>
          <sphereGeometry args={[0.045, 8, 6]} />
          <meshStandardMaterial color="#E5B48C" roughness={0.85} />
        </mesh>
        {/* straw hat: brim + crown */}
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.34, 0.36, 0.035, 12]} />
          <meshStandardMaterial color="#C9AE6A" roughness={0.95} flatShading />
        </mesh>
        <mesh position={[0, 1.38, 0]}>
          <cylinderGeometry args={[0.15, 0.19, 0.14, 10]} />
          <meshStandardMaterial color="#BFA35E" roughness={0.95} flatShading />
        </mesh>
        {/* arms resting on the counter side */}
        <mesh position={[-0.3, 0.62, 0.1]} rotation={[0.5, 0, 0.35]}>
          <capsuleGeometry args={[0.07, 0.3, 3, 8]} />
          <meshStandardMaterial color="#C97E5A" roughness={0.9} />
        </mesh>
        <mesh position={[0.3, 0.62, 0.1]} rotation={[0.5, 0, -0.35]}>
          <capsuleGeometry args={[0.07, 0.3, 3, 8]} />
          <meshStandardMaterial color="#C97E5A" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

export default function WharfShackInterior({
  frozen,
  playerPosRef,
  onNearestStation,
}: {
  frozen: boolean;
  playerPosRef: React.MutableRefObject<import("three").Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene, "#152028"), [scene]);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };

  return (
    <group>
      {/* dockside light: cool dusk blue through the door, warm lamp pool
          over the counter — a shack lit by one good lantern. */}
      <ambientLight color="#BCD0E0" intensity={0.3} />
      <pointLight color="#FFC985" intensity={20} distance={12} position={[0, 2.8, 1.6]} />
      <directionalLight color="#D8E8F4" intensity={0.14} position={[-4, 5, -3]} />

      {/* plank floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onFloorClick}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#9A7A54" roughness={0.9} />
      </mesh>
      {/* driftwood walls */}
      {[
        { pos: [0, 2, 4] as [number, number, number], rot: 0 },
        { pos: [0, 2, -4] as [number, number, number], rot: 0 },
        { pos: [4, 2, 0] as [number, number, number], rot: Math.PI / 2 },
        { pos: [-4, 2, 0] as [number, number, number], rot: Math.PI / 2 },
      ].map((w, i) => (
        <mesh key={i} position={w.pos} rotation={[0, w.rot, 0]}>
          <planeGeometry args={[8, 4]} />
          <meshStandardMaterial color="#6E5A42" roughness={0.95} side={2} />
        </mesh>
      ))}

      <WharfKeeper playerPosRef={playerPosRef} />

      <Suspense fallback={null}>
        {/* the counter — selling happens here */}
        <Piece name="counter-register" position={[0, 0, 2.6]} rotY={Math.PI} scale={0.11} />
        {/* fish-market dressing */}
        <Piece name="barrel" position={[-3, 0, 2.9]} scale={0.1} />
        <Piece name="barrel" position={[-2.2, 0, 3.1]} rotY={0.7} scale={0.09} />
        <Piece name="cardboard-pile" position={[3, 0, 2.8]} rotY={-0.4} scale={0.1} />
        <Piece name="yellow-message-mat" position={[0, 0.015, -3.4]} scale={0.11} />
      </Suspense>

      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={(x, z) => onNearestStation(nearestStation(WHARF_STATIONS, x, z))}
      />
    </group>
  );
}
