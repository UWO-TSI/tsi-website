"use client";

/**
 * ShopInterior (2026-07-14) — ux-interiors.md §5, HQ-room pattern. A cozy
 * 10x10 general store: counter-register station opens the Shop sheet,
 * color-box display shelves flank the walls, barrels + cardboard piles +
 * a stray shopping cart fill the corners. Mint walls per the spec.
 */

import { Suspense, useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { AudioManager } from "@/lib/game/audio";
import {
  InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";

const BOUNDS: RoomBounds = { halfW: 5, halfD: 5, spawn: [0, -3.4] };

export const SHOP_STATIONS: InteriorStation[] = [
  { id: "counter", name: "Counter", pos: [0, 2.6], action: "sheet:shop", range: 2.4 },
  { id: "exit", name: "Exit", pos: [0, -4.4], action: "exit", range: 2.2 },
];

preloadPieces(["counter-register", "color-box-shelf", "barrel", "cardboard-pile", "shopping-cart", "yellow-message-mat"]);

export default function ShopInterior({
  frozen,
  playerPosRef,
  onNearestStation,
}: {
  frozen: boolean;
  playerPosRef: React.MutableRefObject<import("three").Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene), [scene]);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };

  return (
    <group>
      {/* warm-amber pass (2026-07-14, AC interior refs): low warm ambient,
          the shop keeps a touch more brightness than HQ (retail read) but
          the light is all amber — plus a warm counter pool. */}
      <ambientLight color="#FFDCA8" intensity={0.38} />
      <pointLight color="#FFC985" intensity={28} distance={17} position={[0, 3.2, 0]} />
      <directionalLight color="#FFE8C8" intensity={0.18} position={[5, 6, -3]} />
      <pointLight color="#FFDB98" intensity={9} distance={5} position={[0, 2.2, 2.6]} />

      {/* floor + mint walls (§5.3) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onFloorClick}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#D4B896" roughness={0.85} />
      </mesh>
      {[-3, 0, 3].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 0]}>
          <planeGeometry args={[1.2, 10]} />
          <meshStandardMaterial color="#C4A878" roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, 1.75, 5.15]}>
        <boxGeometry args={[10.6, 3.5, 0.3]} />
        <meshStandardMaterial color="#E8F0E8" roughness={0.9} />
      </mesh>
      <mesh position={[-5.15, 1.75, 0]}>
        <boxGeometry args={[0.3, 3.5, 10.6]} />
        <meshStandardMaterial color="#E8F0E8" roughness={0.9} />
      </mesh>
      <mesh position={[5.15, 1.75, 0]}>
        <boxGeometry args={[0.3, 3.5, 10.6]} />
        <meshStandardMaterial color="#E8F0E8" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.45, -5.15]}>
        <boxGeometry args={[10.6, 0.9, 0.3]} />
        <meshStandardMaterial color="#E8F0E8" roughness={0.9} />
      </mesh>
      {/* awning stripe banner behind the counter (§5.2) */}
      {[-4, -2, 0, 2, 4].map((x, i) => (
        <mesh key={i} position={[x, 2.9, 5.0]}>
          <planeGeometry args={[1.6, 0.7]} />
          <meshBasicMaterial color={i % 2 ? "#FFFFFF" : "#FFD166"} side={2} />
        </mesh>
      ))}

      <Suspense fallback={null}>
        {/* Counter + register (→ Shop sheet) */}
        <Piece name="counter-register" position={[0, 0, 3.4]} rotY={Math.PI} scale={0.16} />
        {/* Display shelves */}
        <Piece name="color-box-shelf" position={[-4.1, 0, 2.2]} rotY={Math.PI / 2} scale={0.13} />
        <Piece name="color-box-shelf" position={[4.1, 0, 2.2]} rotY={-Math.PI / 2} scale={0.13} />
        <Piece name="color-box-shelf" position={[-4.1, 0, -0.6]} rotY={Math.PI / 2} scale={0.13} />
        {/* Corner clutter */}
        <Piece name="barrel" position={[4.2, 0, -3.9]} scale={0.09} />
        <Piece name="barrel" position={[3.3, 0, -4.3]} scale={0.085} />
        <Piece name="cardboard-pile" position={[-4.0, 0, -4.0]} rotY={0.5} />
        <Piece name="shopping-cart" position={[3.9, 0, 0.9]} rotY={-0.9} scale={0.09} />
        {/* Exit mat */}
        <Piece name="yellow-message-mat" position={[0, 0.015, -4.3]} scale={0.12} />
      </Suspense>

      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={(x, z) => onNearestStation(nearestStation(SHOP_STATIONS, x, z))}
      />
    </group>
  );
}
