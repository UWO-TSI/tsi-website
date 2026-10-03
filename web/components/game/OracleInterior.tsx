"use client";

/**
 * OracleInterior (2026-07-14) — ux-interiors.md §6, HQ-room pattern. The
 * mystic 12x12 temple hall in its modelled shell (RoomShell: lavender walls on
 * a stone plinth, pilasters, round side windows and a rose window over the
 * altar in the four families' colours, a family banner each with its sigil):
 * real ruins pillars, the magic-circle floor rug, candle clusters, and the
 * crystal altar — the modelled crystal cluster spins above the real altar.glb;
 * E at the altar opens the MBTI quiz sheet. Warm-mystic per §6.4: soft
 * lavender, never scary.
 */

import { Suspense, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { sigilTexture } from "./oracle/sigil";
import { RoomShell, preloadShells, registerShellMaterial, useKitPiece } from "./RoomShell";
import {
  InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";
import Keeper from "./Keeper";

const BOUNDS: RoomBounds = { halfW: 6, halfD: 6, spawn: [0, -4.2] };

export const ORACLE_STATIONS: InteriorStation[] = [
  { id: "altar", name: "Crystal Altar", pos: [0, 2.6], action: "sheet:oracle", range: 2.6 },
  { id: "exit", name: "Exit", pos: [0, -5.4], action: "exit", range: 2.2 },
];

preloadPieces(["altar", "remains-pillar", "magic-circle-rug", "candle"]);
preloadShells(["oracle"]);

/** The banners along the back wall, screen right to left (build_interiors.py FAMILY_BANNERS: atlas cells 0..3). */
const BANNER_FAMILIES: Family[] = ["Arcane", "Ranger", "Warden", "Vanguard"];
const darken = (hex: string, k: number) => `#${new THREE.Color(hex).multiplyScalar(k).getHexString()}`;

/** The four family banners as one atlas (a 256 x 640 cell each): deep cloth, a thread border, the family's sigil. */
function bannerMaterial(): THREE.Material {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 640;
  const g = canvas.getContext("2d")!;
  BANNER_FAMILIES.forEach((family, k) => {
    const x0 = k * 256, cloth = darken(FAMILIES[family].color, 0.62);
    const grad = g.createLinearGradient(x0, 0, x0 + 256, 0);
    grad.addColorStop(0, darken(cloth, 0.86)); grad.addColorStop(0.5, cloth); grad.addColorStop(1, darken(cloth, 0.86));
    g.fillStyle = grad; g.fillRect(x0, 0, 256, 640);
    // A woven texture: fine horizontal threads.
    g.globalAlpha = 0.08; g.fillStyle = "#000000";
    for (let y = 0; y < 640; y += 4) g.fillRect(x0, y, 256, 1);
    g.globalAlpha = 1;
    // The thread border inside the edges, and a band under the rod.
    g.strokeStyle = "#e6cc8c"; g.lineWidth = 6;
    g.strokeRect(x0 + 18, 22, 220, 560);
    g.lineWidth = 2; g.strokeRect(x0 + 28, 32, 200, 540);
    g.fillStyle = "#e6cc8c"; g.fillRect(x0 + 18, 70, 220, 5);
    const sigil = sigilTexture(family, 256);
    g.globalAlpha = 0.95;
    g.drawImage(sigil.image as HTMLCanvasElement, x0 + 33, 150, 190, 190);
    g.globalAlpha = 1;
    sigil.dispose();
    // The family's name in thread under the sigil.
    g.fillStyle = "#efdcae"; g.font = "700 30px Georgia, serif"; g.textAlign = "center";
    g.fillText(family.toUpperCase(), x0 + 128, 400);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.MeshStandardMaterial({ name: "Banners", map: tex, roughness: 0.95, side: THREE.DoubleSide });
}

/** The rose window's stained glass: eight petals in the families' colours round a lilac heart, lead between them. */
function roseMaterial(): THREE.Material {
  const S = 512, canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!, c = S / 2, R = S / 2;
  g.fillStyle = "#2c2436"; g.fillRect(0, 0, S, S);
  const petals = ["Arcane", "Ranger", "Vanguard", "Warden", "Arcane", "Ranger", "Vanguard", "Warden"] as Family[];
  for (let k = 0; k < 8; k++) {
    const a0 = Math.PI / 8 + (k * Math.PI) / 4, a1 = a0 + Math.PI / 4;
    const grad = g.createRadialGradient(c, c, R * 0.3, c, c, R);
    grad.addColorStop(0, FAMILIES[petals[k]].light); grad.addColorStop(1, darken(FAMILIES[petals[k]].color, 0.85));
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(c, c); g.arc(c, c, R * 0.98, a0, a1); g.closePath(); g.fill();
    // A smaller pane in each petal.
    const am = (a0 + a1) / 2;
    g.fillStyle = "#fff4d8"; g.globalAlpha = 0.5;
    g.beginPath(); g.arc(c + Math.cos(am) * R * 0.66, c + Math.sin(am) * R * 0.66, R * 0.09, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
  }
  g.fillStyle = "#d9c8f6";
  g.beginPath(); g.arc(c, c, R * 0.32, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#2c2436"; g.lineWidth = 7;
  for (const r of [0.32, 0.5, 0.82]) { g.beginPath(); g.arc(c, c, R * r, 0, Math.PI * 2); g.stroke(); }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ name: "RoseGlass", map: tex, color: "#c9c0d6" });
}
registerShellMaterial("oracle_banners", bannerMaterial);
registerShellMaterial("oracle_rose", roseMaterial);
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
  const ref = useRef<THREE.Group>(null);
  const crystal = useKitPiece("oracle_crystal");
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = performance.now() / 1000;
    m.rotation.y = t * 0.6;
    m.position.y = 2.35 + Math.sin(t * 1.1) * 0.12;
  });
  return <group ref={ref} position={[0, 2.35, 2.6]}><primitive object={crystal} /></group>;
}

export default function OracleInterior({
  frozen,
  playerPosRef,
  onNearestStation,
  tint = "#D4B0FF",
  talking = false,
  light = ISLAND_LIGHTING.day,
}: {
  /** The island's light now: the windows follow the time of day. */
  light?: IslandLight;
  /** The quiz sheet is open at the altar: the keeper faces you and says the quiz's reactions. */
  talking?: boolean;
  /** Temple light colour; the reveal ceremony washes it in the family colour (row 206). */
  tint?: string;
  frozen: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onNearestStation: (s: InteriorStation | null) => void;
}) {
  const { scene } = useThree();
  useEffect(() => applyInteriorBackdrop(scene, "#100D18"), [scene]);

  return (
    <group>
      {/* warm-amber pass (2026-07-14, AC interior refs): the temple keeps
          its violet identity but drops the flat fill — candle pools +
          crystal glow carry the room. */}
      <ambientLight color="#D8C4EE" intensity={0.4} />
      <pointLight color={tint} intensity={26} distance={19} position={[0, 4.2, 0]} />
      <pointLight color={tint} intensity={10} distance={7} position={[0, 3, 2.6]} />
      <pointLight color="#FFCF8A" intensity={10} distance={5.5} position={[-2.2, 1, 2.2]} />
      <pointLight color="#FFCF8A" intensity={10} distance={5.5} position={[2.2, 1, 2.2]} />

      {/* the temple's walls, windows, banners and floor (art/interiors/build_interiors.py) */}
      <Suspense fallback={null}><RoomShell room="oracle" light={light} /></Suspense>

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

      {/* The Oracle keeper beside the altar (lib/game/keepers.ts); the quiz's reactions are hers to say. */}
      <Keeper room="oracle" player={playerPosRef} frozen={frozen} engaged={talking} sayEvent="tsi:oracle-keeper" />
      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={(x, z) => onNearestStation(nearestStation(ORACLE_STATIONS, x, z))}
      />
    </group>
  );
}
