"use client";

/**
 * HQInterior — the Resident-Services main room (ux-interiors.md §3).
 * Uses the shared interior kit (interiorShared.tsx) since 2026-07-14;
 * see that file for the walker/piece/backdrop implementation.
 */

import { Suspense, useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import {
  InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";

const BOUNDS: RoomBounds = { halfW: 8, halfD: 6, spawn: [0, -4.2] };

// Room bounds (spec §2.6: HQ main 16x12, walls at x ±8, z ±6)
const HALF_W = 8;
const HALF_D = 6;

export type { InteriorStation };

export const HQ_STATIONS: InteriorStation[] = [
  { id: "board", name: "Bulletin Board", pos: [-4.5, 5.1], action: "sheet:directory" },
  { id: "trophy", name: "Trophy Case", pos: [4.2, 5.1], action: "sheet:leaderboard" },
  { id: "desk", name: "Front Desk", pos: [-5.2, -2.4], action: "sheet:profile" },
  { id: "shelf", name: "Bookshelf", pos: [5.6, -2.8], action: "sheet:quests" },
  { id: "admin", name: "Admin Room", pos: [-7.5, 1.2], action: "admin", range: 2.2 },
  { id: "exit", name: "Exit", pos: [0, -5.5], action: "exit", range: 2.4 },
];

// ── real ACNH furniture (P2 dump extraction 2026-07-13) ──
// Pieces are floor-origin normalized at extraction; ACNH items face -Z.
preloadPieces([
  "bulletinboard", "gold-hha-trophy", "silver-hha-trophy", "bronze-hha-trophy",
  "study-desk", "study-chair", "bookshelf", "acorn-rug", "antique-clock",
  "plant-monstera", "plant-yucca", "yellow-message-mat", "wooden-chest",
]);

export default function HQInterior({
  frozen,
  playerPosRef,
  onNearestStation,
}: {
  frozen: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();

  useEffect(() => applyInteriorBackdrop(scene), [scene]);

  const handleMove = (x: number, z: number) => onNearestStation(nearestStation(HQ_STATIONS, x, z));

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };


  return (
    <group>
      {/* lighting (spec §2.4) */}
      <ambientLight color="#FFF5E1" intensity={0.6} />
      <pointLight color="#FFE4B0" intensity={45} distance={22} position={[0, 3.8, 0]} />
      <directionalLight color="#FFFFFF" intensity={0.3} position={[6, 6, -4]} />
      <pointLight color="#FFE4B0" intensity={8} distance={5} position={[-4.5, 2.4, 4.6]} />
      <pointLight color="#FFE4B0" intensity={8} distance={5} position={[4.2, 2.4, 4.6]} />

      {/* floor: warm planks + alternating strips */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onFloorClick}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial color="#D4B896" roughness={0.85} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0]}>
          <planeGeometry args={[1.4, 12]} />
          <meshStandardMaterial color="#C4A878" roughness={0.85} />
        </mesh>
      ))}
      {/* acorn rug — warm centerpiece */}
      <Suspense fallback={null}>
        <Piece name="acorn-rug" position={[0, 0.015, 0.6]} scale={0.18} />
      </Suspense>

      {/* walls: north full, sides full, south low lip (dollhouse cutaway) */}
      <mesh position={[0, 2, HALF_D + 0.15]}>
        <boxGeometry args={[16.6, 4, 0.3]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      <mesh position={[-HALF_W - 0.15, 2, 0]}>
        <boxGeometry args={[0.3, 4, 12.6]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      <mesh position={[HALF_W + 0.15, 2, 0]}>
        <boxGeometry args={[0.3, 4, 12.6]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -HALF_D - 0.15]}>
        <boxGeometry args={[16.6, 1, 0.3]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      {/* wainscoting on the three tall walls */}
      <mesh position={[0, 0.6, HALF_D + 0.14 - 0.16]}>
        <boxGeometry args={[16.6, 1.2, 0.06]} />
        <meshStandardMaterial color="#B8935A" roughness={0.9} />
      </mesh>
      <mesh position={[-HALF_W - 0.15 + 0.16, 0.6, 0]}>
        <boxGeometry args={[0.06, 1.2, 12.6]} />
        <meshStandardMaterial color="#B8935A" roughness={0.9} />
      </mesh>
      <mesh position={[HALF_W + 0.15 - 0.16, 0.6, 0]}>
        <boxGeometry args={[0.06, 1.2, 12.6]} />
        <meshStandardMaterial color="#B8935A" roughness={0.9} />
      </mesh>

      {/* Bulletin Board (→ Directory) hung on the north wall */}
      <Suspense fallback={null}>
        {/* (basic-wall window/entrance modules removed 2026-07-13 — they're
            room-SHELL panels, and inset against painted walls they read as
            white slabs. Real windows return with the full module-shell
            room rebuild in Phase 2.) */}
        <Piece name="bulletinboard" position={[-4.5, 1.15, 5.55]} scale={0.16} />

        {/* Trophy display (→ Leaderboard): chest pedestal + the HHA tier set */}
        <Piece name="wooden-chest" position={[4.2, 0, 5.2]} />
        <Piece name="gold-hha-trophy" position={[4.2, 0.8, 5.2]} />
        <Piece name="silver-hha-trophy" position={[3.55, 0.8, 5.35]} scale={0.085} />
        <Piece name="bronze-hha-trophy" position={[4.85, 0.8, 5.35]} scale={0.085} />

        {/* Front Desk (→ Profile) + chair */}
        <Piece name="study-desk" position={[-5.2, 0, -2.4]} scale={0.11} />
        <Piece name="study-chair" position={[-5.2, 0, -0.7]} rotY={Math.PI} />

        {/* Bookshelf (→ Quests) */}
        <Piece name="bookshelf" position={[5.6, 0, -3.1]} />

        {/* Grandfather clock by the admin door */}
        <Piece name="antique-clock" position={[-7.1, 0, 3.6]} rotY={-Math.PI / 2} />

        {/* Corner plants */}
        <Piece name="plant-monstera" position={[-7.2, 0, 5.2]} />
        <Piece name="plant-yucca" position={[7.2, 0, 5.2]} />
      </Suspense>

      {/* Admin door (locked) on the west wall */}
      <group position={[-7.85, 0, 1.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[1.5, 2.5, 0.14]} />
          <meshStandardMaterial color="#7A5636" roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.75, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color="#FFD166" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Exit: TSI-yellow message mat at the south lip */}
      <Suspense fallback={null}>
        <Piece name="yellow-message-mat" position={[0, 0.015, -5.2]} scale={0.14} />
      </Suspense>

      {/* framed pictures on the north wall */}
      {[[-2, 2.6, "#4C7DD0"], [1.6, 2.8, "#E85050"], [6.8, 2.6, "#5FA850"]].map(([x, y, c], i) => (
        <mesh key={i} position={[x as number, y as number, 5.7]}>
          <planeGeometry args={[0.7, 0.55]} />
          <meshBasicMaterial color={c as string} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <InteriorPlayer frozen={frozen} bounds={BOUNDS} playerPosRef={playerPosRef} onMove={handleMove} />
    </group>
  );
}
