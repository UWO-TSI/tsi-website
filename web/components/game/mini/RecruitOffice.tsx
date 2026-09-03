"use client";

/**
 * RecruitOffice — the inside of Tethos HQ on the applicant island. The
 * HQ room kit (interiorShared) with one desk per open role, a recruiter
 * behind each, a hiring board on the north wall, and the exit mat at the
 * door. Stations resolve to `apply:<slug>` or `exit` in MiniWorld's key
 * handler.
 */

import { Suspense, useEffect, useMemo } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { AudioManager } from "@/lib/game/audio";
import {
  InteriorPlayer,
  InteriorKeeper,
  Piece,
  applyInteriorBackdrop,
  nearestStation,
  preloadPieces,
  type InteriorStation,
  type RoomBounds,
} from "../interiorShared";
import { DESK_Z, type Desk } from "@/lib/game/miniIsland";

const HALF_W = 8;
const HALF_D = 6;
const BOUNDS: RoomBounds = { halfW: HALF_W, halfD: HALF_D, spawn: [0, -4.2] };

export const EXIT_STATION: InteriorStation = { id: "exit", name: "Leave the office", pos: [0, -5.3], action: "exit", range: 2.2 };

preloadPieces(["study-desk", "bulletinboard", "acorn-rug", "plant-monstera", "plant-yucca", "yellow-message-mat", "bookshelf"]);

export function officeStations(desks: Desk[], appliedIds: Set<string>): InteriorStation[] {
  return [
    ...desks.map((d) => ({
      id: d.position.slug,
      name: appliedIds.has(d.position.id) ? `${d.position.title} (applied)` : `Apply: ${d.position.title}`,
      pos: [d.x, DESK_Z - 1.4] as [number, number],
      action: `apply:${d.position.slug}`,
      range: 2.1,
    })),
    EXIT_STATION,
  ];
}

export default function RecruitOffice({
  desks,
  appliedIds,
  frozen,
  playerPosRef,
  onNearestStation,
}: {
  desks: Desk[];
  appliedIds: Set<string>;
  frozen: boolean;
  playerPosRef: React.MutableRefObject<import("three").Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene), [scene]);
  const stations = useMemo(() => officeStations(desks, appliedIds), [desks, appliedIds]);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };

  return (
    <group>
      {/* warm-amber rig from HQInterior */}
      <ambientLight color="#FFD9A0" intensity={0.34} />
      <pointLight color="#FFC985" intensity={32} distance={20} position={[0, 3.8, 0]} />
      <directionalLight color="#FFE8C8" intensity={0.18} position={[6, 6, -4]} />
      {desks.map((d) => (
        <pointLight key={`lamp-${d.position.slug}`} color="#FFDB98" intensity={9} distance={5.5} position={[d.x, 2.4, DESK_Z + 1]} />
      ))}

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onFloorClick}>
        <planeGeometry args={[HALF_W * 2, HALF_D * 2]} />
        <meshStandardMaterial color="#D4B896" roughness={0.85} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0]}>
          <planeGeometry args={[1.4, HALF_D * 2]} />
          <meshStandardMaterial color="#C4A878" roughness={0.85} />
        </mesh>
      ))}

      {/* walls: north full, sides full, south low lip (dollhouse cutaway) */}
      <mesh position={[0, 2, HALF_D + 0.15]}>
        <boxGeometry args={[HALF_W * 2 + 0.6, 4, 0.3]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      <mesh position={[-HALF_W - 0.15, 2, 0]}>
        <boxGeometry args={[0.3, 4, HALF_D * 2 + 0.6]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      <mesh position={[HALF_W + 0.15, 2, 0]}>
        <boxGeometry args={[0.3, 4, HALF_D * 2 + 0.6]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -HALF_D - 0.15]}>
        <boxGeometry args={[HALF_W * 2 + 0.6, 1, 0.3]} />
        <meshStandardMaterial color="#FFF8EE" roughness={0.9} />
      </mesh>
      {/* wainscoting */}
      <mesh position={[0, 0.6, HALF_D - 0.02]}>
        <boxGeometry args={[HALF_W * 2 + 0.6, 1.2, 0.06]} />
        <meshStandardMaterial color="#B8935A" roughness={0.9} />
      </mesh>
      <mesh position={[-HALF_W + 0.01, 0.6, 0]}>
        <boxGeometry args={[0.06, 1.2, HALF_D * 2 + 0.6]} />
        <meshStandardMaterial color="#B8935A" roughness={0.9} />
      </mesh>
      <mesh position={[HALF_W - 0.01, 0.6, 0]}>
        <boxGeometry args={[0.06, 1.2, HALF_D * 2 + 0.6]} />
        <meshStandardMaterial color="#B8935A" roughness={0.9} />
      </mesh>

      {/* hiring board on the north wall */}
      <Suspense fallback={null}>
        <Piece name="bulletinboard" position={[0, 1.15, HALF_D - 0.45]} scale={0.16} />
      </Suspense>
      <Html zIndexRange={[40, 0]} position={[0, 3.05, HALF_D - 0.5]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
        <div
          style={{
            fontSize: 12,
            color: "#2a2a2a",
            background: "rgba(255,255,255,0.9)",
            padding: "3px 10px",
            borderRadius: 6,
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            whiteSpace: "nowrap",
          }}
        >
          Now hiring: 2026-27 exec team
        </div>
      </Html>

      {/* desks, one per open role, recruiter behind each */}
      <Suspense fallback={null}>
        {desks.map((d) => {
          const applied = appliedIds.has(d.position.id);
          return (
            <group key={d.position.slug}>
              <Piece name="study-desk" position={[d.x, 0, DESK_Z]} rotY={Math.PI} scale={0.11} />
              <InteriorKeeper
                position={[d.x, 0, DESK_Z + 1.35]}
                watch={[d.x, DESK_Z - 1.4]}
                colors={d.recruiter.colors}
                hat={d.recruiter.hat}
                playerPosRef={playerPosRef}
              />
              <Html zIndexRange={[40, 0]} position={[d.x, 2.35, DESK_Z + 0.4]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
                <div
                  style={{
                    textAlign: "center",
                    fontFamily: "'IBM Plex Mono', monospace",
                    whiteSpace: "nowrap",
                    background: "rgba(15,15,16,0.72)",
                    borderRadius: 6,
                    padding: "4px 10px",
                    color: "#F1FFFF",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{d.position.title}</div>
                  <div style={{ fontSize: 10, color: applied ? "#22C55E" : "#FFD166" }}>
                    {applied ? "Applied" : `${d.recruiter.name}, ${d.recruiter.title}`}
                  </div>
                </div>
              </Html>
            </group>
          );
        })}
        <Piece name="acorn-rug" position={[0, 0.015, -1.2]} scale={0.18} />
        <Piece name="bookshelf" position={[-HALF_W + 0.9, 0, HALF_D - 1.2]} rotY={Math.PI / 2} scale={0.12} />
        <Piece name="plant-monstera" position={[HALF_W - 1, 0, HALF_D - 1]} scale={0.11} />
        <Piece name="plant-yucca" position={[-HALF_W + 1, 0, -HALF_D + 1.2]} scale={0.11} />
        <Piece name="yellow-message-mat" position={[0, 0.015, -5.2]} scale={0.12} />
      </Suspense>

      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={(x, z) => onNearestStation(nearestStation(stations, x, z))}
      />
    </group>
  );
}
