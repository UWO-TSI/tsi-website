"use client";

/**
 * HQInterior — the Resident-Services main room (ux-interiors.md §3).
 * Uses the shared interior kit (interiorShared.tsx) since 2026-07-14;
 * see that file for the walker/piece/backdrop implementation.
 */

import { Suspense, useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { HQ_LAYOUT, HQ_PENDANTS } from "@/lib/game/applicantVillage";
import { AudioManager } from "@/lib/game/audio";
import { APPLICANT_HQ_LIGHTING } from "@/lib/game/applicantLighting";
import type { ApplicantDayPhase } from "@/lib/game/applicantTime";
import {
  InteriorKeeper,
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
  "floor-lamp", "clubhouse-pendant", "lounge-rug", "reading-table", "lounge-sofa", "lounge-table", "lounge-tea", "lounge-book",
]);

export default function HQInterior({
  avatarMode = "sprite",
  frozen,
  playerPosRef,
  onNearestStation,
  stations = HQ_STATIONS,
  constrainMove,
  recruitment = false,
  floorTexture,
  phase = "day",
}: {
  avatarMode?: "sprite" | "applicant";
  recruitment?: boolean;
  floorTexture?: THREE.Texture;
  phase?: ApplicantDayPhase;
  stations?: InteriorStation[];
  constrainMove?: (x: number, z: number, nx: number, nz: number) => [number, number];
  frozen: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  const light = APPLICANT_HQ_LIGHTING[phase];

  useEffect(() => applyInteriorBackdrop(scene), [scene]);

  const handleMove = (x: number, z: number) => onNearestStation(nearestStation(stations, x, z));

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };


  return (
    <group>
      {/* Neutral fill preserves atlas colors; warmth comes from local lamp pools. */}
      <ambientLight color={recruitment ? "#fff7ed" : "#FFD9A0"} intensity={recruitment ? light.ambient : 0.34} />
      {recruitment && <hemisphereLight args={["#dde8ff", "#b79c80", light.hemisphere]} />}
      {!recruitment && <pointLight color="#FFC985" intensity={32} distance={16} position={[0, 3.8, 0.6]} />}
      <directionalLight color="#fff4df" intensity={recruitment ? light.key : 0.18} position={[3, 8, -4]}
        castShadow={recruitment} shadow-mapSize={[2048, 2048]} shadow-radius={3}
        shadow-bias={-0.00015} shadow-normalBias={0.025}
        shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12}
        shadow-camera-near={0.5} shadow-camera-far={30} />
      {recruitment ? <>
        <Suspense fallback={null}>
          {HQ_PENDANTS.map(({ position, scale, drop, power }) => <group key={position[0]} position={position}>
            <Piece name="clubhouse-pendant" position={[0, 0, 0]} scale={scale} />
            <pointLight color="#ffe3ba" intensity={light.ceiling * power} distance={8} position={[0, -drop, 0]} />
          </group>)}
          <Piece name="floor-lamp" {...HQ_LAYOUT.loungeLamp} />
        </Suspense>
        <pointLight color="#ffdfae" intensity={light.lamp * 0.48} distance={4.8}
          position={[HQ_LAYOUT.loungeLamp.position[0], 1.52, HQ_LAYOUT.loungeLamp.position[2]]} />
        {/* The study desk already contains its own lamp model. */}
        <pointLight color="#ffe2ae" intensity={light.desk} distance={3.3}
          position={[HQ_LAYOUT.desk.position[0] + 0.4, 1.6, HQ_LAYOUT.desk.position[2] - 0.1]} />
      </> : <>
        <pointLight color="#FFDB98" intensity={11} distance={5.5} position={[-4.5, 2.4, 4.6]} />
        <pointLight color="#FFDB98" intensity={11} distance={5.5} position={[4.2, 2.4, 4.6]} />
      </>}

      {/* floor: warm planks + alternating strips */}
      <mesh receiveShadow={recruitment} rotation={[-Math.PI / 2, 0, 0]} onClick={onFloorClick}>
        <planeGeometry args={[16, 12]} />
        <meshStandardMaterial map={floorTexture} color={floorTexture ? "#fff7ee" : "#D4B896"} roughness={0.9} />
      </mesh>
      {!floorTexture && [-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0]}>
          <planeGeometry args={[1.4, 12]} />
          <meshStandardMaterial color="#C4A878" roughness={0.85} />
        </mesh>
      ))}
      <Suspense fallback={null}>
        {recruitment ? <>
          <Piece name="lounge-rug" position={[HQ_LAYOUT.sofa.position[0], 0.012, 3.7]} scale={0.13} />
          <Piece shadows name="lounge-sofa" {...HQ_LAYOUT.sofa} />
          <Piece shadows name="lounge-table" {...HQ_LAYOUT.table} />
          <Piece name="lounge-tea" position={[HQ_LAYOUT.table.position[0] + 0.25, 0.624, HQ_LAYOUT.table.position[2]]} scale={0.075} />
          <Piece name="lounge-book" position={[HQ_LAYOUT.table.position[0] - 0.55, 0.624, HQ_LAYOUT.table.position[2]]} scale={0.065} rotY={0.25} />
        </> : <Piece name="acorn-rug" position={[0, 0.015, 0.6]} scale={0.18} />}
      </Suspense>

      {/* walls: north full, sides full, south low lip (dollhouse cutaway) */}
      <mesh position={[0, 2, HALF_D + 0.15]}>
        <boxGeometry args={[16.6, 4, 0.3]} />
        <meshStandardMaterial color={recruitment ? "#d3dbca" : "#FFF8EE"} roughness={0.9} />
      </mesh>
      <mesh position={[-HALF_W - 0.15, 2, 0]}>
        <boxGeometry args={[0.3, 4, 12.6]} />
        <meshStandardMaterial color={recruitment ? "#d3dbca" : "#FFF8EE"} roughness={0.9} />
      </mesh>
      <mesh position={[HALF_W + 0.15, 2, 0]}>
        <boxGeometry args={[0.3, 4, 12.6]} />
        <meshStandardMaterial color={recruitment ? "#d3dbca" : "#FFF8EE"} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -HALF_D - 0.15]}>
        <boxGeometry args={[16.6, 1, 0.3]} />
        <meshStandardMaterial color={recruitment ? "#d3dbca" : "#FFF8EE"} roughness={0.9} />
      </mesh>
      {/* wainscoting on the three tall walls */}
      <mesh position={[0, 0.6, HALF_D + 0.14 - 0.16]}>
        <boxGeometry args={[16.6, 1.2, 0.06]} />
        <meshStandardMaterial color={recruitment ? "#a1ae91" : "#B8935A"} roughness={0.9} />
      </mesh>
      <mesh position={[-HALF_W - 0.15 + 0.16, 0.6, 0]}>
        <boxGeometry args={[0.06, 1.2, 12.6]} />
        <meshStandardMaterial color={recruitment ? "#a1ae91" : "#B8935A"} roughness={0.9} />
      </mesh>
      <mesh position={[HALF_W + 0.15 - 0.16, 0.6, 0]}>
        <boxGeometry args={[0.06, 1.2, 12.6]} />
        <meshStandardMaterial color={recruitment ? "#a1ae91" : "#B8935A"} roughness={0.9} />
      </mesh>

      {/* Bulletin Board (→ Directory) hung on the north wall */}
      <Suspense fallback={null}>
        {/* (basic-wall window/entrance modules removed 2026-07-13 — they're
            room-SHELL panels, and inset against painted walls they read as
            white slabs. Real windows return with the full module-shell
            room rebuild in Phase 2.) */}
        <Piece name="bulletinboard" {...(recruitment ? HQ_LAYOUT.board : { position: [-4.5, 1.15, 5.55] as [number, number, number], scale: 0.16 })} />

        {/* Trophy display (→ Leaderboard): chest pedestal + the HHA tier set */}
        <Piece shadows={recruitment} name="wooden-chest" rotX={recruitment ? -Math.PI / 2 : 0} position={recruitment ? HQ_LAYOUT.display.position : [4.2, 0, 5.2]} rotY={recruitment ? Math.PI : 0} />
        <Piece shadows={recruitment} name="gold-hha-trophy" rotX={recruitment ? Math.PI / 2 : 0} position={[recruitment ? HQ_LAYOUT.display.position[0] : 4.2, 0.8, 5.2]} rotY={recruitment ? Math.PI : 0} />
        <Piece shadows={recruitment} name="silver-hha-trophy" rotX={recruitment ? Math.PI / 2 : 0} position={[recruitment ? HQ_LAYOUT.display.position[0] - 0.65 : 3.55, 0.8, 5.35]} rotY={recruitment ? Math.PI : 0} scale={0.085} />
        <Piece shadows={recruitment} name="bronze-hha-trophy" rotX={recruitment ? Math.PI / 2 : 0} position={[recruitment ? HQ_LAYOUT.display.position[0] + 0.65 : 4.85, 0.8, 5.35]} rotY={recruitment ? Math.PI : 0} scale={0.085} />

        {/* Front Desk (→ Profile) + chair */}
        <Piece shadows={recruitment} name="study-desk" rotX={recruitment ? Math.PI : 0} position={HQ_LAYOUT.desk.position} rotY={recruitment ? HQ_LAYOUT.desk.rotY : 0} scale={HQ_LAYOUT.desk.scale} />
        <Piece shadows={recruitment} name="study-chair" {...HQ_LAYOUT.deskChair} />

        {/* Bookshelf (→ Quests) */}
        <Piece shadows={recruitment} name="bookshelf" position={recruitment ? HQ_LAYOUT.shelf.position : [5.6, 0, -3.1]} rotY={recruitment ? Math.PI / 2 : 0} />

        {recruitment && <Piece shadows name="study-chair" {...HQ_LAYOUT.loungeChair} />}

        {/* Clock against the north wall, facing into the room. */}
        <Piece shadows={recruitment} name="antique-clock" glassMaterial={recruitment ? "FtrAntiqueClock_mat0" : undefined} position={recruitment ? HQ_LAYOUT.clock.position : [-7.1, 0, 3.6]} rotY={recruitment ? Math.PI : -Math.PI / 2} />

        {/* Corner plants */}
        <Piece shadows={recruitment} name="plant-monstera" position={recruitment ? HQ_LAYOUT.monstera.position : [-7.2, 0, 5.2]} />
        <Piece shadows={recruitment} name="plant-yucca" position={recruitment ? HQ_LAYOUT.yucca.position : [7.2, 0, 5.2]} />
      </Suspense>

      {/* Admin door (locked) on the west wall */}
      {!recruitment && <group position={[-7.85, 0, 1.2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[1.5, 2.5, 0.14]} />
          <meshStandardMaterial color="#7A5636" roughness={0.85} />
        </mesh>
        <mesh position={[0, 2.75, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color="#FFD166" side={THREE.DoubleSide} />
        </mesh>
      </group>}

      {/* Exit: TSI-yellow message mat at the south lip */}
      <Suspense fallback={null}>
        <Piece name="yellow-message-mat" rotX={recruitment ? Math.PI : 0} rotY={recruitment ? Math.PI : 0} position={[0, 0.015, -5.2]} scale={0.14} />
      </Suspense>

      {/* framed pictures on the north wall */}
      {!recruitment && [[-2, 2.6, "#4C7DD0"], [1.6, 2.8, "#E85050"], [6.8, 2.6, "#5FA850"]].map(([x, y, c], i) => (
        <mesh key={i} position={[x as number, y as number, 5.7]}>
          <planeGeometry args={[0.7, 0.55]} />
          <meshBasicMaterial color={c as string} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* wake 69: front-desk receptionist (navy blazer, hair bun) */}
      <InteriorKeeper position={[-6.3, 0, -2.4]} rotY={Math.PI / 2} watch={[-5.2, -2.4]} colors={{ apron: "#2E3E5C", shirt: "#F0E6D2" }} hat="bun" playerPosRef={playerPosRef} />
      <InteriorPlayer avatarMode={avatarMode} frozen={frozen} bounds={BOUNDS} playerPosRef={playerPosRef} onMove={handleMove} constrainMove={constrainMove} />
    </group>
  );
}
