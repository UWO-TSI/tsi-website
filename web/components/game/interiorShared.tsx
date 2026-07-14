"use client";

/**
 * interiorShared (2026-07-14) — the room kit extracted from HQInterior so
 * Shop and Oracle rooms reuse one implementation: sprite walker with
 * parameterized bounds, GLB furniture piece, scene backdrop swap, and the
 * station type the central E-handler consumes.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export interface InteriorStation {
  id: string;
  name: string;
  pos: [number, number];
  action: string; // "sheet:<key>" | "admin" | "exit"
  range?: number;
}

export interface RoomBounds {
  halfW: number;
  halfD: number;
  spawn: [number, number];
}

const WALK_MARGIN = 0.8;
const PLAYER_SPEED = 4.6;
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

// Module escape hatches for imperative three mutations (react-compiler).
export function applyInteriorBackdrop(scene: THREE.Scene, color = "#14100C"): () => void {
  const prevBg = scene.background;
  const prevFog = scene.fog;
  scene.background = new THREE.Color(color);
  scene.fog = null;
  return () => {
    scene.background = prevBg;
    scene.fog = prevFog;
  };
}

function followInteriorCamera(camera: THREE.Camera, px: number, pz: number, delta: number) {
  camera.position.x = THREE.MathUtils.damp(camera.position.x, px, 6, delta);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, 8.4, 6, delta);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, pz - 7.2, 6, delta);
  camera.lookAt(px, 0.7, pz + 1.2);
}

export function InteriorPlayer({
  frozen,
  bounds,
  playerPosRef,
  onMove,
}: {
  frozen: boolean;
  bounds: RoomBounds;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onMove: (x: number, z: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef({ x: bounds.spawn[0], z: bounds.spawn[1] });
  const targetRef = useRef<{ x: number; z: number } | null>(null);
  const dirRef = useRef(1);
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
      p.x = THREE.MathUtils.clamp(p.x + vx * PLAYER_SPEED * delta, -bounds.halfW + WALK_MARGIN, bounds.halfW - WALK_MARGIN);
      p.z = THREE.MathUtils.clamp(p.z + vz * PLAYER_SPEED * delta, -bounds.halfD + WALK_MARGIN, bounds.halfD - WALK_MARGIN);
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
    <group ref={groupRef} position={[bounds.spawn[0], 0, bounds.spawn[1]]}>
      <mesh position={[0, 0.82, -0.012]} scale={[1.07, 1.07, 1]}>
        <planeGeometry args={[1.45, 1.45]} />
        <meshBasicMaterial map={tex} color="#2A2118" transparent opacity={0.55} alphaTest={0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
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

const FURNITURE_BASE = "/assets/acnh/furniture";

export function Piece({ name, position, rotY = 0, scale = 0.1 }: { name: string; position: [number, number, number]; rotY?: number; scale?: number }) {
  const { scene } = useGLTF(`${FURNITURE_BASE}/${name}.glb`);
  const clone = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={clone} position={position} rotation={[0, rotY, 0]} scale={[scale, scale, scale]} />;
}

export function preloadPieces(names: string[]): void {
  names.forEach((n) => useGLTF.preload(`${FURNITURE_BASE}/${n}.glb`));
}

/** Nearest-station helper shared by all rooms. */
export function nearestStation(stations: InteriorStation[], x: number, z: number): InteriorStation | null {
  let best: InteriorStation | null = null;
  let bestD = Infinity;
  for (const s of stations) {
    const d = Math.hypot(s.pos[0] - x, s.pos[1] - z);
    const range = s.range ?? 2;
    if (d < range && d < bestD) { bestD = d; best = s; }
  }
  return best;
}
