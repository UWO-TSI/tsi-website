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

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FAMILIES } from "@/lib/game/oracle/family";
import type { Family } from "@/lib/oracle/engine";
import { ISLAND_LIGHTING, type IslandLight } from "@/lib/game/islandLighting";
import { interiorLight } from "@/lib/game/interiorLight";
import InteriorDaylight from "./InteriorDaylight";
import { sigilTexture } from "./oracle/sigil";
import { RoomShell, preloadShells, registerShellMaterial, useKitPiece } from "./RoomShell";
import CandleFire, { type Wick } from "./oracle/CandleFire";
import { worldTime } from "@/lib/game/worldClock";
import {
  InteriorPlayer, Piece, applyInteriorBackdrop, preloadPieces, useNearestStation,
  type InteriorStation, type RoomBounds,
} from "./interiorShared";
import Keeper from "./Keeper";

const BOUNDS: RoomBounds = { halfW: 6, halfD: 6, spawn: [0, -4.2] };

export const ORACLE_STATIONS: InteriorStation[] = [
  { id: "altar", name: "Crystal Altar", pos: [0, 2.6], action: "sheet:oracle", range: 2.6 },
  { id: "exit", name: "Exit", pos: [0, -5.4], action: "exit", range: 1.1 },
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
  tex.flipY = false; // the shell's UVs are glTF's (v down the image)
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
  tex.flipY = false;
  return (rose = new THREE.MeshBasicMaterial({ name: "RoseGlass", map: tex, color: "#c9c0d6" }));
}
let rose: THREE.MeshBasicMaterial | null = null;
/** The rose window glows with the day behind it and darkens to a deep jewel at night (module scope: written from an effect). */
function lightRose(day: number) { rose?.color.setRGB(0.28 + 0.6 * day, 0.26 + 0.58 * day, 0.36 + 0.55 * day); }
registerShellMaterial("oracle_banners", bannerMaterial);
registerShellMaterial("oracle_rose", roseMaterial);
// The candles (dump chambersticks, authored upside down: turned over and grounded) and their wicks' tips.
const CANDLES: { x: number; z: number; rotY: number; scale: number }[] = [
  { x: -1.5, z: 1.4, rotY: 0, scale: 0.09 }, { x: 1.6, z: 1.5, rotY: 1.2, scale: 0.08 },
  { x: -1.2, z: 3.9, rotY: 2.2, scale: 0.08 }, { x: 1.3, z: 3.8, rotY: 0.4, scale: 0.09 },
];
/** candle.glb is 6.02 tall, its wick at its foot (the model's origin): after the turn the wick tips the candle. */
const WICKS: Wick[] = CANDLES.map(c => ({ x: c.x, z: c.z, top: 6.02 * c.scale + 0.005 }));
const CANDLE_POOLS = [[-2.2, 1, 2.2], [2.2, 1, 2.2]] as const;

/** The crystal breathes: its glow (in the room's light colour, the family's in the reveal) and its light swell and ease. */
const CRYSTAL_GLOW = { base: 0.55, swell: 0.45 };
function pulseCrystal(materials: readonly THREE.MeshStandardMaterial[], light: THREE.PointLight | null, tint: string, t: number) {
  // A slow breath with a soft second beat: never a blink.
  const p = Math.pow(0.5 + 0.5 * Math.sin(t * 1.25), 2) * 0.8 + 0.2 * (0.5 + 0.5 * Math.sin(t * 2.5 + 0.6));
  for (const m of materials) {
    if (m.userData.tint !== tint) { m.emissive.set(tint); m.userData.tint = tint; }
    m.emissiveIntensity = (m.name === "M_CrystalDeep" ? 0.7 : 1) * (CRYSTAL_GLOW.base + CRYSTAL_GLOW.swell * p);
  }
  if (light) light.intensity = 8 + 6 * p;
}

function FloatingCrystal({ tint }: { tint: string }) {
  const ref = useRef<THREE.Group>(null), glow = useRef<THREE.PointLight>(null);
  const crystal = useKitPiece("oracle_crystal");
  const materials = useMemo(() => {
    const out = new Set<THREE.MeshStandardMaterial>();
    crystal.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh && (mesh.material as THREE.MeshStandardMaterial).emissive) out.add(mesh.material as THREE.MeshStandardMaterial); });
    return [...out];
  }, [crystal]);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = worldTime();
    m.rotation.y = t * 0.6;
    m.position.y = 2.35 + Math.sin(t * 1.1) * 0.12;
    pulseCrystal(materials, glow.current, tint, t);
  });
  return <>
    <group ref={ref} position={[0, 2.35, 2.6]}><primitive object={crystal} /></group>
    <pointLight ref={glow} color={tint} intensity={10} distance={7} position={[0, 3, 2.6]} />
  </>;
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
  const day = interiorLight(light).day;
  const onMove = useNearestStation(ORACLE_STATIONS, onNearestStation);
  useEffect(() => lightRose(day), [day]);

  return (
    <group>
      {/* The temple keeps its violet identity: a lavender fill, the day (or the moon) through its windows, and the
          candle pools and the crystal's glow carrying it at night. */}
      <InteriorDaylight light={light} tint="#cdb6ee" scale={{ key: 0.9, ambient: 0.4, hemisphere: 0.22, extent: 9 }} />
      <pointLight color={tint} intensity={26} distance={19} position={[0, 4.2, 0]} />

      {/* the temple's walls, windows, banners and floor (art/interiors/build_interiors.py) */}
      <Suspense fallback={null}><RoomShell room="oracle" light={light} /></Suspense>

      <Suspense fallback={null}>
        {/* runic circle + altar + crystal (→ Oracle quiz sheet) */}
        <Piece name="magic-circle-rug" position={[0, 0.012, 2.6]} scale={0.14} />
        <Piece name="altar" position={[0, 0, 2.6]} scale={0.11} />
        <FloatingCrystal tint={tint} />
        {/* ruins pillars flanking the altar */}
        <Piece name="remains-pillar" position={[-3.6, 0, 3.6]} scale={0.12} />
        <Piece name="remains-pillar" position={[3.6, 0, 3.6]} rotY={0.6} scale={0.12} />
        {/* the candles, lit: painted flames on the wicks and sparks drifting up (CandleFire) */}
        {CANDLES.map(c => <Piece key={c.x} name="candle" position={[c.x, 0, c.z]} rotY={c.rotY} rotX={Math.PI} scale={c.scale} />)}
        <CandleFire wicks={WICKS} pools={CANDLE_POOLS} poolIntensity={10} />
        {/* exit mat */}
        <Piece name="yellow-message-mat" rotX={Math.PI} rotY={Math.PI} position={[0, 0.015, -5.3]} scale={0.12} />
      </Suspense>

      {/* The Oracle keeper beside the altar (lib/game/keepers.ts); the quiz's reactions are hers to say. */}
      <Keeper room="oracle" player={playerPosRef} frozen={frozen} engaged={talking} sayEvent="tsi:oracle-keeper" />
      <InteriorPlayer
        frozen={frozen}
        bounds={BOUNDS}
        playerPosRef={playerPosRef}
        onMove={onMove}
      />
    </group>
  );
}
