"use client";

/**
 * HQInterior (interiors-lite pillar, 2026-07-13) — the Resident-Services
 * main room from specs/ux-interiors.md §3, dollhouse-cutaway style.
 *
 * Scope decisions for the -lite pass (spec is Phase-2 full-3D):
 * - One room (HQ Main), spec §9 priority 1. Admin room is a locked door
 *   with a "restricted" toast for now.
 * - Dollhouse view: no ceiling, low front lip instead of a south wall —
 *   the fixed follow-camera (distance ~10, polar ~65°) sits above ceiling
 *   height, so a real ceiling would occlude everything.
 * - Stations open the SAME overlay sheets the world uses (Directory /
 *   Leaderboard / Profile / Quests) — no new page surfaces.
 * - Player is a compact sprite walker (WASD + click-to-move on the flat
 *   floor) reusing the Ninja Adventure walk sheet; the full PlayerAvatar
 *   carries terrain/curve/fishing machinery that has no business inside.
 *
 * All procedural: zero GLBs, loads instantly behind the 0.3s fade.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";

// Room bounds (spec §2.6: HQ main 16x12, walls at x ±8, z ±6)
const HALF_W = 8;
const HALF_D = 6;
const WALK_MARGIN = 0.8;
const PLAYER_SPEED = 4.6;

export interface InteriorStation {
  id: string;
  name: string;
  pos: [number, number];
  action: string; // "sheet:<key>" | "admin" | "exit"
  range?: number;
}

export const HQ_STATIONS: InteriorStation[] = [
  { id: "board", name: "Bulletin Board", pos: [-4.5, 5.1], action: "sheet:directory" },
  { id: "trophy", name: "Trophy Case", pos: [4.2, 5.1], action: "sheet:leaderboard" },
  { id: "desk", name: "Front Desk", pos: [-5.2, -2.4], action: "sheet:profile" },
  { id: "shelf", name: "Bookshelf", pos: [5.6, -2.8], action: "sheet:quests" },
  { id: "admin", name: "Admin Room", pos: [-7.5, 1.2], action: "admin", range: 2.2 },
  { id: "exit", name: "Exit", pos: [0, -5.5], action: "exit", range: 2.4 },
];

// ── player sprite sheet (same asset/layout as PlayerAvatar) ──
const SHEET_COLS = 4;
const SHEET_ROWS = 4;
const FRAME_RATE = 8;
const keys: Record<string, boolean> = {};

let _walkTex: THREE.Texture | null = null;
function getWalkTexture(): THREE.Texture {
  if (!_walkTex) {
    const tex = new THREE.TextureLoader().load("/assets/characters/player_walk.png");
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / SHEET_COLS, 1 / SHEET_ROWS);
    tex.offset.set(0, 1 - 1 / SHEET_ROWS);
    _walkTex = tex;
  }
  return _walkTex;
}

// Module escape hatches for imperative three mutations (react-compiler
// treats hook-returned objects as frozen inside component code).
function applyInteriorBackdrop(scene: THREE.Scene): () => void {
  const prevBg = scene.background;
  const prevFog = scene.fog;
  scene.background = new THREE.Color("#14100C");
  scene.fog = null;
  return () => {
    scene.background = prevBg;
    scene.fog = prevFog;
  };
}

function followInteriorCamera(camera: THREE.Camera, px: number, pz: number, delta: number) {
  const tx = px;
  const ty = 8.4;
  const tz = pz - 7.2;
  camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 6, delta);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 6, delta);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, tz, 6, delta);
  camera.lookAt(px, 0.7, pz + 1.2);
}

function InteriorPlayer({
  frozen,
  playerPosRef,
  onMove,
}: {
  frozen: boolean;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onMove: (x: number, z: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef({ x: 0, z: -4.2 }); // spawn at the door
  const targetRef = useRef<{ x: number; z: number } | null>(null);
  const dirRef = useRef(1); // sheet column: 0 down 1 up 2 left 3 right
  const animRef = useRef(0);
  const frozenRef = useRef(frozen);
  useEffect(() => { frozenRef.current = frozen; }, [frozen]);
  const tex = useMemo(() => getWalkTexture(), []);
  const { camera } = useThree();

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const up = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Click-to-move target from the floor (wired by the parent's floor mesh).
  useEffect(() => {
    const onTarget = (e: Event) => {
      const { x, z } = (e as CustomEvent<{ x: number; z: number }>).detail;
      targetRef.current = { x, z };
    };
    window.addEventListener("tsi:interior-move", onTarget);
    return () => window.removeEventListener("tsi:interior-move", onTarget);
  }, []);

  useFrame((_, delta) => {
    const p = posRef.current;
    let vx = 0, vz = 0;
    if (!frozenRef.current) {
      if (keys["w"] || keys["arrowup"]) vz += 1;
      if (keys["s"] || keys["arrowdown"]) vz -= 1;
      if (keys["a"] || keys["arrowleft"]) vx += 1;
      if (keys["d"] || keys["arrowright"]) vx -= 1;
      if (vx !== 0 || vz !== 0) {
        targetRef.current = null;
        const len = Math.hypot(vx, vz);
        vx /= len; vz /= len;
      } else if (targetRef.current) {
        const dx = targetRef.current.x - p.x;
        const dz = targetRef.current.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) targetRef.current = null;
        else { vx = dx / d; vz = dz / d; }
      }
    }

    const moving = vx !== 0 || vz !== 0;
    if (moving) {
      p.x = THREE.MathUtils.clamp(p.x + vx * PLAYER_SPEED * delta, -HALF_W + WALK_MARGIN, HALF_W - WALK_MARGIN);
      p.z = THREE.MathUtils.clamp(p.z + vz * PLAYER_SPEED * delta, -HALF_D + WALK_MARGIN, HALF_D - WALK_MARGIN);
      dirRef.current = Math.abs(vx) > Math.abs(vz) ? (vx > 0 ? 2 : 3) : vz > 0 ? 1 : 0;
      animRef.current += delta * FRAME_RATE;
      onMove(p.x, p.z);
      playerPosRef.current.set(p.x, 0, p.z);
    } else {
      animRef.current = 0;
    }

    const col = dirRef.current;
    const row = moving ? Math.floor(animRef.current) % SHEET_ROWS : 0;
    tex.offset.set(col / SHEET_COLS, 1 - (row + 1) / SHEET_ROWS);

    if (groupRef.current) groupRef.current.position.set(p.x, 0, p.z);
    if (meshRef.current) {
      const bob = moving ? Math.sin(animRef.current * Math.PI) * 0.04 : Math.sin(performance.now() / 600) * 0.015;
      meshRef.current.position.y = 0.82 + bob;
    }
    followInteriorCamera(camera, p.x, p.z, delta);
  });

  return (
    <group ref={groupRef} position={[0, 0, -4.2]}>
      <mesh ref={meshRef} position={[0, 0.82, 0]}>
        <planeGeometry args={[1.45, 1.45]} />
        <meshBasicMaterial map={tex} transparent alphaTest={0.1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── procedural furniture bits ──
function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.5, 10]} />
        <meshStandardMaterial color="#C4825A" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <sphereGeometry args={[0.38, 12, 10]} />
        <meshStandardMaterial color="#5FA850" roughness={0.85} />
      </mesh>
    </group>
  );
}

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

  // Warm dark backdrop while inside (no sky dome here). Module fn = the
  // sanctioned escape hatch for mutating hook-returned three objects.
  useEffect(() => applyInteriorBackdrop(scene), [scene]);

  const handleMove = (x: number, z: number) => {
    let best: InteriorStation | null = null;
    let bestD = Infinity;
    for (const s of HQ_STATIONS) {
      const d = Math.hypot(s.pos[0] - x, s.pos[1] - z);
      const range = s.range ?? 2;
      if (d < range && d < bestD) { bestD = d; best = s; }
    }
    onNearestStation(best);
  };

  const onFloorClick = (e: ThreeEvent<MouseEvent>) => {
    window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
    AudioManager.playSFX("click");
  };

  const bookColors = ["#E85050", "#4C7DD0", "#5FA850", "#FFD166", "#9B6BB0", "#FF9944"];

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
      {/* rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.6]}>
        <planeGeometry args={[6.4, 4.4]} />
        <meshStandardMaterial color="#D4A876" roughness={0.95} />
      </mesh>

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

      {/* Bulletin Board (→ Directory) on the north wall */}
      <group position={[-4.5, 0, 5.75]}>
        <mesh position={[0, 1.9, 0]}>
          <boxGeometry args={[2.6, 1.6, 0.12]} />
          <meshStandardMaterial color="#8B6B4A" roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.9, -0.07]}>
          <boxGeometry args={[2.3, 1.3, 0.04]} />
          <meshStandardMaterial color="#C89F70" roughness={1} />
        </mesh>
        {[[-0.7, 2.2, "#E85050"], [0.1, 1.75, "#4C7DD0"], [0.7, 2.1, "#FFD166"], [-0.2, 1.6, "#5FA850"]].map(([x, y, c], i) => (
          <mesh key={i} position={[x as number, y as number, -0.1]}>
            <planeGeometry args={[0.42, 0.34]} />
            <meshBasicMaterial color={c as string} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* Trophy Case (→ Leaderboard) */}
      <group position={[4.2, 0, 5.4]}>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[2.8, 2.2, 0.9]} />
          <meshStandardMaterial color="#8B6B4A" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.35, -0.48]}>
          <planeGeometry args={[2.5, 1.5]} />
          <meshStandardMaterial color="#BFE3EA" roughness={0.2} metalness={0.1} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        {[[-0.8, "#FFD166"], [0, "#D8D8E0"], [0.8, "#D08A4E"]].map(([x, c], i) => (
          <mesh key={i} position={[x as number, 1.62 - (i === 0 ? 0 : 0.08), -0.2]}>
            <coneGeometry args={[0.16, 0.42, 8]} />
            <meshStandardMaterial color={c as string} metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
      </group>

      {/* Front Desk (→ Profile) */}
      <group position={[-5.2, 0, -2.4]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[2.6, 1.1, 1.2]} />
          <meshStandardMaterial color="#B8935A" roughness={0.85} />
        </mesh>
        <mesh position={[0.6, 1.22, 0.1]}>
          <boxGeometry args={[0.55, 0.14, 0.4]} />
          <meshStandardMaterial color="#F5F0E6" roughness={0.8} />
        </mesh>
        <mesh position={[-0.7, 1.35, -0.05]}>
          <cylinderGeometry args={[0.09, 0.13, 0.5, 8]} />
          <meshStandardMaterial color="#3D6B4F" roughness={0.7} />
        </mesh>
        <mesh position={[0.2, 0.35, 1.25]}>
          <boxGeometry args={[0.9, 0.7, 0.8]} />
          <meshStandardMaterial color="#E87B5A" roughness={0.9} />
        </mesh>
      </group>

      {/* Bookshelf (→ Quests) against the east wall */}
      <group position={[5.6, 0, -2.8]}>
        <mesh position={[0, 1.45, 0]}>
          <boxGeometry args={[2.2, 2.9, 0.8]} />
          <meshStandardMaterial color="#8B6B4A" roughness={0.9} />
        </mesh>
        {[0.7, 1.5, 2.3].map((y, row) => (
          <group key={row}>
            {[-0.75, -0.35, 0.05, 0.45, 0.8].map((x, i) => (
              <mesh key={i} position={[x, y, -0.42]}>
                <boxGeometry args={[0.26, 0.5, 0.1]} />
                <meshStandardMaterial color={bookColors[(row * 5 + i) % bookColors.length]} roughness={0.9} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh position={[0, 3.15, 0]}>
          <sphereGeometry args={[0.25, 10, 8]} />
          <meshStandardMaterial color="#5FA850" roughness={0.85} />
        </mesh>
      </group>

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

      {/* Exit: welcome mat at the south lip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, -5.2]}>
        <planeGeometry args={[2.2, 1.2]} />
        <meshStandardMaterial color="#7EC850" roughness={0.95} />
      </mesh>

      {/* wall clock + framed pictures on the north wall */}
      <mesh position={[0, 3.1, 5.68]}>
        <circleGeometry args={[0.4, 20]} />
        <meshBasicMaterial color="#FFF5E1" side={THREE.DoubleSide} />
      </mesh>
      {[[-2, 2.6, "#4C7DD0"], [1.6, 2.8, "#E85050"], [6.8, 2.6, "#5FA850"]].map(([x, y, c], i) => (
        <mesh key={i} position={[x as number, y as number, 5.7]}>
          <planeGeometry args={[0.7, 0.55]} />
          <meshBasicMaterial color={c as string} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <Plant x={-7.2} z={5.2} />
      <Plant x={7.2} z={5.2} />

      <InteriorPlayer frozen={frozen} playerPosRef={playerPosRef} onMove={handleMove} />
    </group>
  );
}
