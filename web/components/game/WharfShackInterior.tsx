"use client";

/**
 * WharfShackInterior (GEO S4 / ECON E3, 2026-07-25) — the fishing store.
 * A snug 8x8 dockside room: counter station opens the SELL sheet (the
 * Shack buys catches for coins 🪙), barrels + crates give it the fish-
 * market read. Gear-for-coins shelf lands with E4.
 * Purpose-first per the collab contract: this room's job is SELLING.
 */

import { Suspense, useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { AudioManager } from "@/lib/game/audio";
import {
  InteriorKeeper, InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";

const BOUNDS: RoomBounds = { halfW: 4, halfD: 4, spawn: [0, -2.8] };

export const WHARF_STATIONS: InteriorStation[] = [
  { id: "counter", name: "Sell Catches", pos: [0, 2.2], action: "sheet:wharfsell", range: 2.4 },
  { id: "exit", name: "Exit", pos: [0, -3.5], action: "exit", range: 2.0 },
];

preloadPieces(["counter-register", "barrel", "cardboard-pile", "yellow-message-mat"]);

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

      <InteriorKeeper position={[0, 0, 3.35]} watch={[0, 2.2]} colors={{ apron: "#3E5C7A", shirt: "#C97E5A" }} hat="straw" playerPosRef={playerPosRef} />

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
