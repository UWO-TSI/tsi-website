"use client";

/**
 * OracleInterior (2026-07-14) — ux-interiors.md §6, HQ-room pattern. The
 * mystic 12x12 temple hall: real ruins pillars, the magic-circle floor
 * rug, candle clusters, four class banners, and the crystal altar — a
 * procedural floating crystal (the one hero FX) spins above the real
 * altar.glb; E at the altar opens the MBTI quiz sheet. Warm-mystic per
 * §6.4: soft lavender, never scary.
 */

import { Suspense, useEffect, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import {
  InteriorKeeper,
  InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";

const BOUNDS: RoomBounds = { halfW: 6, halfD: 6, spawn: [0, -4.2] };

export const ORACLE_STATIONS: InteriorStation[] = [
  { id: "altar", name: "Crystal Altar", pos: [0, 2.6], action: "sheet:oracle", range: 2.6 },
  { id: "exit", name: "Exit", pos: [0, -5.4], action: "exit", range: 2.2 },
];

preloadPieces(["altar", "remains-pillar", "magic-circle-rug", "candle"]);

const BANNERS = [
  { x: -5.7, color: "#E85050" }, { x: -1.9, color: "#002FA7" },
  { x: 1.9, color: "#22C55E" }, { x: 5.7, color: "#FFD166" },
];

// Candle embers (loop wake 41): three warm motes per cluster rise from the
// flames, drift, shrink, and fade on staggered loops — the temple's candle
// pools get living fire. Refs only, one useFrame.
const CANDLE_XZ: [number, number][] = [
  [-1.5, 1.4],
  [1.6, 1.5],
  [-1.2, 3.9],
  [1.3, 3.8],
];

function CandleEmbers() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let k = 0; k < refs.current.length; k++) {
      const m = refs.current[k];
      if (!m) continue;
      const cluster = CANDLE_XZ[Math.floor(k / 3)];
      const speed = 0.3 + (k % 3) * 0.08;
      const p = (t * speed + k * 0.71) % 1;
      m.position.set(
        cluster[0] + Math.sin(t * 1.6 + k * 2.1) * 0.06 * p,
        0.34 + p * 0.6,
        cluster[1] + Math.cos(t * 1.2 + k * 1.7) * 0.05 * p
      );
      m.scale.setScalar(1 - p * 0.7);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - p);
    }
  });
  return (
    <group>
      {CANDLE_XZ.flatMap((_, i) =>
        [0, 1, 2].map((j) => (
          <mesh
            key={`${i}-${j}`}
            ref={(el) => {
              refs.current[i * 3 + j] = el;
            }}
          >
            <sphereGeometry args={[0.02, 6, 4]} />
            <meshBasicMaterial color="#FFC070" transparent opacity={0} depthWrite={false} toneMapped={false} />
          </mesh>
        ))
      )}
    </group>
  );
}

function FloatingCrystal() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = performance.now() / 1000;
    m.rotation.y = t * 0.6;
    m.position.y = 2.35 + Math.sin(t * 1.1) * 0.12;
  });
  return (
    <mesh ref={ref} position={[0, 2.35, 2.6]}>
      <icosahedronGeometry args={[0.42, 0]} />
      <meshStandardMaterial color="#7B5EA7" emissive="#D4B0FF" emissiveIntensity={0.55} roughness={0.25} metalness={0.1} />
    </mesh>
  );
}

export default function OracleInterior({
  frozen,
  playerPosRef,
  onNearestStation,
}: {
  frozen: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene, "#100D18"), [scene]);

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };

  return (
    <group>
      {/* warm-amber pass (2026-07-14, AC interior refs): the temple keeps
          its violet identity but drops the flat fill — candle pools +
          crystal glow carry the room. */}
      <ambientLight color="#D8C4EE" intensity={0.4} />
      <pointLight color="#D4B0FF" intensity={26} distance={19} position={[0, 4.2, 0]} />
      <pointLight color="#D4B0FF" intensity={10} distance={7} position={[0, 3, 2.6]} />
      <pointLight color="#FFCF8A" intensity={10} distance={5.5} position={[-2.2, 1, 2.2]} />
      <pointLight color="#FFCF8A" intensity={10} distance={5.5} position={[2.2, 1, 2.2]} />

      {/* stone floor + lavender walls (§6.3) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} onClick={onFloorClick}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#A09080" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.5, 6.15]}>
        <boxGeometry args={[12.6, 5, 0.3]} />
        <meshStandardMaterial color="#F0E8F5" roughness={0.9} />
      </mesh>
      <mesh position={[-6.15, 2.5, 0]}>
        <boxGeometry args={[0.3, 5, 12.6]} />
        <meshStandardMaterial color="#F0E8F5" roughness={0.9} />
      </mesh>
      <mesh position={[6.15, 2.5, 0]}>
        <boxGeometry args={[0.3, 5, 12.6]} />
        <meshStandardMaterial color="#F0E8F5" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.5, -6.15]}>
        <boxGeometry args={[12.6, 1, 0.3]} />
        <meshStandardMaterial color="#F0E8F5" roughness={0.9} />
      </mesh>
      {/* class banners on the north wall (§6.2) */}
      {BANNERS.map((b, i) => (
        <mesh key={i} position={[b.x * 0.9, 3.1, 5.98]}>
          <planeGeometry args={[1.1, 2.2]} />
          <meshBasicMaterial color={b.color} side={2} />
        </mesh>
      ))}

      <Suspense fallback={null}>
        {/* runic circle + altar + crystal (→ Oracle quiz sheet) */}
        <Piece name="magic-circle-rug" position={[0, 0.012, 2.6]} scale={0.14} />
        <Piece name="altar" position={[0, 0, 2.6]} scale={0.11} />
        <FloatingCrystal />
        {/* ruins pillars flanking the altar */}
        <Piece name="remains-pillar" position={[-3.6, 0, 3.6]} scale={0.12} />
        <Piece name="remains-pillar" position={[3.6, 0, 3.6]} rotY={0.6} scale={0.12} />
        {/* candle clusters */}
        <Piece name="candle" position={[-1.5, 0, 1.4]} scale={0.09} />
        <Piece name="candle" position={[1.6, 0, 1.5]} rotY={1.2} scale={0.08} />
        <Piece name="candle" position={[-1.2, 0, 3.9]} rotY={2.2} scale={0.08} />
        <Piece name="candle" position={[1.3, 0, 3.8]} rotY={0.4} scale={0.09} />
        <CandleEmbers />
        {/* exit mat */}
        <Piece name="yellow-message-mat" position={[0, 0.015, -5.3]} scale={0.12} />
      </Suspense>

      {/* wake 69: hooded altar attendant */}
      <InteriorKeeper position={[1.9, 0, 3.6]} rotY={Math.PI + 0.4} watch={[0, 2.6]} colors={{ apron: "#5A4A7E", shirt: "#8E7BB0" }} hat="hood" playerPosRef={playerPosRef} />
      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={(x, z) => onNearestStation(nearestStation(ORACLE_STATIONS, x, z))}
      />
    </group>
  );
}
