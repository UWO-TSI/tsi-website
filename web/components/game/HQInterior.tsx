"use client";

/**
 * HQInterior — the Resident-Services main room (ux-interiors.md §3), in its
 * modelled shell (RoomShell: panelled walls, four windows with drapes, the
 * framed doorway). Uses the shared interior kit (interiorShared.tsx) for the
 * walker, pieces and backdrop.
 */

import { Suspense, useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import type * as THREE from "three";
import { HQ_LAYOUT, HQ_PENDANTS } from "@/lib/game/clubhouse";
import { AudioManager } from "@/lib/game/audio";
import { CLUBHOUSE_LIGHTING, ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { interiorLight } from "@/lib/game/interiorLight";
import InteriorDaylight from "./InteriorDaylight";
import TickingClock from "./TickingClock";
import type { IslandPhase } from "@/lib/game/islandTime";
import {
  InteriorPlayer, Piece, applyInteriorBackdrop, preloadPieces, useNearestStation,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";
import Keeper from "./Keeper";
import { RoomShell, preloadShells } from "./RoomShell";

const BOUNDS: RoomBounds = { halfW: 8, halfD: 6, spawn: [0, -4.2] };

export type { InteriorStation };

export const HQ_STATIONS: InteriorStation[] = [
  { id: "board", name: "Bulletin Board", pos: [-4.5, 5.1], action: "sheet:directory" },
  { id: "trophy", name: "Trophy Case", pos: [4.2, 5.1], action: "sheet:leaderboard" },
  { id: "desk", name: "Front Desk", pos: [-5.2, -3.6], action: "sheet:profile" },
  { id: "shelf", name: "Bookshelf", pos: [5.6, -2.8], action: "sheet:quests" },
  { id: "exit", name: "Exit", pos: [0, -5.5], action: "exit", range: 1.1 },
];

// ── real ACNH furniture (P2 dump extraction 2026-07-13) ──
// Pieces are floor-origin normalized at extraction; ACNH items face -Z.
preloadPieces([
  "bulletinboard", "gold-hha-trophy", "silver-hha-trophy", "bronze-hha-trophy",
  "study-desk", "study-chair", "bookshelf", "acorn-rug", "antique-clock",
  "plant-monstera", "plant-yucca", "yellow-message-mat", "wooden-chest",
  "floor-lamp", "clubhouse-pendant", "lounge-rug", "reading-table", "lounge-sofa", "lounge-table", "lounge-tea", "lounge-book",
]);
preloadShells(["hq"]);

export default function HQInterior({
  frozen,
  playerPosRef,
  onNearestStation,
  stations = HQ_STATIONS,
  constrainMove,
  clubhouse = false,
  floorTexture,
  phase = "day",
  light: islandLight,
  talking = false,
}: {
  /** The island's light now (blended across the phases); the phase's look when not given (the applicant island). */
  light?: IslandLight;
  /** The front desk's sheet is open: the HQ lead serves you. */
  talking?: boolean;
  clubhouse?: boolean;
  floorTexture?: THREE.Texture;
  phase?: IslandPhase;
  stations?: InteriorStation[];
  constrainMove?: (x: number, z: number, nx: number, nz: number) => [number, number];
  frozen: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  const outside = islandLight ?? ISLAND_LIGHTING[phase];
  // Lamps at their night strength, eased down by day (lib/game/interiorLight.ts).
  const lamp = CLUBHOUSE_LIGHTING.night, lamps = interiorLight(outside).lamps;

  useEffect(() => applyInteriorBackdrop(scene), [scene]);

  const handleMove = useNearestStation(stations, onNearestStation);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };


  return (
    <group>
      {/* The day through the windows (the sun, or the moon's cool sliver at night); warmth comes from the lamp pools. */}
      <InteriorDaylight light={outside} shadows={clubhouse} scale={{ key: 1.5, ambient: 0.32, hemisphere: 0.36, extent: 12 }} />
      <Suspense fallback={null}>
        {HQ_PENDANTS.map(({ position, scale }) => <group key={position[0]} position={position}>
          <Piece name="clubhouse-pendant" position={[0, 0, 0]} scale={scale} />
        </group>)}
        <Piece name="floor-lamp" {...HQ_LAYOUT.loungeLamp} />
      </Suspense>
      {HQ_PENDANTS.map(({ position, drop, power }) => <pointLight key={position[0]} color="#ffe3ba" intensity={lamp.ceiling * power * lamps} distance={8}
        position={[position[0], position[1] - drop, position[2]]} />)}
      <pointLight color="#ffdfae" intensity={lamp.lamp * 0.48 * lamps} distance={4.8}
        position={[HQ_LAYOUT.loungeLamp.position[0], 1.52, HQ_LAYOUT.loungeLamp.position[2]]} />
      {/* The study desk already contains its own lamp model. */}
      <pointLight color="#ffe2ae" intensity={lamp.desk * lamps} distance={3.3}
        position={[HQ_LAYOUT.desk.position[0] + 0.4, 1.6, HQ_LAYOUT.desk.position[2] - 0.1]} />

      {/* floor: warm planks + alternating strips */}
      <mesh receiveShadow={clubhouse} rotation={[-Math.PI / 2, 0, 0]} onClick={onFloorClick}>
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
        {clubhouse ? <>
          <Piece name="lounge-rug" position={[HQ_LAYOUT.sofa.position[0], 0.012, 3.7]} scale={0.13} />
          <Piece shadows name="lounge-sofa" {...HQ_LAYOUT.sofa} />
          <Piece shadows name="lounge-table" {...HQ_LAYOUT.table} />
          <Piece name="lounge-tea" position={[HQ_LAYOUT.table.position[0] + 0.25, 0.624, HQ_LAYOUT.table.position[2]]} scale={0.075} />
          <Piece name="lounge-book" position={[HQ_LAYOUT.table.position[0] - 0.55, 0.624, HQ_LAYOUT.table.position[2]]} scale={0.065} rotY={0.25} />
        </> : <Piece name="acorn-rug" position={[0, 0.015, 0.6]} scale={0.18} />}
      </Suspense>

      {/* walls, windows and the doorway (art/interiors/build_interiors.py) */}
      <Suspense fallback={null}><RoomShell room="hq" light={outside} /></Suspense>

      {/* Bulletin Board (→ Directory) hung on the north wall */}
      <Suspense fallback={null}>
        <Piece name="bulletinboard" {...(clubhouse ? HQ_LAYOUT.board : { position: [-4.5, 1.15, 5.55] as [number, number, number], scale: 0.16 })} />

        {/* Trophy display (→ Leaderboard): chest pedestal + the HHA tier set */}
        <Piece shadows={clubhouse} name="wooden-chest" rotX={clubhouse ? -Math.PI / 2 : 0} position={clubhouse ? HQ_LAYOUT.display.position : [4.2, 0, 5.2]} rotY={clubhouse ? Math.PI : 0} />
        <Piece shadows={clubhouse} name="gold-hha-trophy" rotX={clubhouse ? Math.PI / 2 : 0} position={[clubhouse ? HQ_LAYOUT.display.position[0] : 4.2, 0.8, 5.2]} rotY={clubhouse ? Math.PI : 0} />
        <Piece shadows={clubhouse} name="silver-hha-trophy" rotX={clubhouse ? Math.PI / 2 : 0} position={[clubhouse ? HQ_LAYOUT.display.position[0] - 0.65 : 3.55, 0.8, 5.35]} rotY={clubhouse ? Math.PI : 0} scale={0.085} />
        <Piece shadows={clubhouse} name="bronze-hha-trophy" rotX={clubhouse ? Math.PI / 2 : 0} position={[clubhouse ? HQ_LAYOUT.display.position[0] + 0.65 : 4.85, 0.8, 5.35]} rotY={clubhouse ? Math.PI : 0} scale={0.085} />

        {/* Front Desk (→ Profile) + chair */}
        <Piece shadows={clubhouse} name="study-desk" rotX={clubhouse ? Math.PI : 0} position={HQ_LAYOUT.desk.position} rotY={clubhouse ? HQ_LAYOUT.desk.rotY : 0} scale={HQ_LAYOUT.desk.scale} />
        <Piece shadows={clubhouse} name="study-chair" {...HQ_LAYOUT.deskChair} />

        {/* Bookshelf (→ Quests) */}
        <Piece shadows={clubhouse} name="bookshelf" position={clubhouse ? HQ_LAYOUT.shelf.position : [5.6, 0, -3.1]} rotY={clubhouse ? Math.PI / 2 : 0} />

        {clubhouse && <Piece shadows name="study-chair" {...HQ_LAYOUT.loungeChair} />}

        {/* Clock against the north wall, facing into the room: its pendulum swings and its hands keep the island's time. */}
        <TickingClock glassMaterial={clubhouse ? "FtrAntiqueClock_mat0" : undefined} position={clubhouse ? HQ_LAYOUT.clock.position : [-7.1, 0, 3.6]} rotY={clubhouse ? Math.PI : -Math.PI / 2} player={playerPosRef} />

        {/* Corner plants */}
        <Piece shadows={clubhouse} name="plant-monstera" position={clubhouse ? HQ_LAYOUT.monstera.position : [-7.2, 0, 5.2]} />
        <Piece shadows={clubhouse} name="plant-yucca" position={clubhouse ? HQ_LAYOUT.yucca.position : [7.2, 0, 5.2]} />
      </Suspense>

      {/* Exit: TSI-yellow message mat at the south lip */}
      <Suspense fallback={null}>
        <Piece name="yellow-message-mat" rotX={clubhouse ? Math.PI : 0} rotY={clubhouse ? Math.PI : 0} position={[0, 0.015, -5.2]} scale={0.14} />
      </Suspense>

      {/* The HQ lead at the front desk (lib/game/keepers.ts). */}
      <Keeper room="hq" player={playerPosRef} frozen={frozen} engaged={talking} />
      <InteriorPlayer frozen={frozen} bounds={BOUNDS} playerPosRef={playerPosRef} onMove={handleMove} constrainMove={constrainMove} />
    </group>
  );
}
