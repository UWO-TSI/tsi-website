"use client";

/**
 * interiorShared (2026-07-14) — the room kit extracted from HQInterior so
 * Shop and Oracle rooms reuse one implementation: character walker with
 * parameterized bounds, GLB furniture piece, scene backdrop swap, and the
 * station type the central E-handler consumes.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { bindGameKeys } from "@/lib/game/keyboardInput";
import { PIECE_TINTS, type Tint } from "@/lib/game/furniturePalettes";
import * as THREE from "three";
import Character, { CHARACTER_SCALE, type CharacterMotion, type ClipName } from "./character/Character";
import { useWorldClips } from "./character/useWorldClips";
import { useMyLook } from "@/lib/game/character/lookStore";
import { seatLift } from "@/lib/game/character/clips";
import { easeFacing } from "@/lib/game/locomotion";

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
const keys: Record<string, boolean> = {};

// Module escape hatches for imperative three mutations (react-compiler).
export function applyInteriorBackdrop(scene: THREE.Scene, color = "#14100C"): () => void {
  const prevBg = scene.background;
  const prevFog = scene.fog;
  const backdrop = new THREE.Color(color);
  scene.background = backdrop;
  scene.fog = null;
  return () => {
    // R3F may already have attached the next scene's backdrop before effect
    // cleanup. Restore only values this interior still owns.
    if (scene.background === backdrop) scene.background = prevBg;
    if (scene.fog === null) scene.fog = prevFog;
  };
}

export function followInteriorCamera(camera: THREE.Camera, px: number, pz: number, delta: number) {
  camera.position.x = THREE.MathUtils.damp(camera.position.x, px, 6, delta);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, 8.4, 6, delta);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, pz - 7.2, 6, delta);
  camera.lookAt(px, 0.7, pz + 1.2);
}

/**
 * Interior walker. Seats work as outdoors: `tsi:sit {x, z, clip?, seatY?, yaw?}`
 * (x/z in room space) sits, studies or sleeps there until a move key.
 */
export function InteriorPlayer({
  frozen,
  bounds,
  playerPosRef,
  onMove,
  constrainMove,
}: {
  frozen: boolean;
  bounds: RoomBounds;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onMove: (x: number, z: number) => void;
  constrainMove?: (x: number, z: number, nx: number, nz: number) => [number, number];
}) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null });
  const { look } = useMyLook();
  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef({ x: bounds.spawn[0], z: bounds.spawn[1] });
  const targetRef = useRef<{ x: number; z: number } | null>(null);
  const seatRef = useRef<{ x: number; z: number; clip: ClipName; lift: number; yaw: number } | null>(null);
  const { camera } = useThree();
  const face = useCallback((x: number, z: number) => { motion.current.yaw = Math.atan2(x - posRef.current.x, z - posRef.current.z); }, []);
  useWorldClips(motion, face);
  useEffect(() => {
    const onSit = (e: Event) => {
      const { x, z, clip = "Sit", seatY = 0, yaw = 0 } = (e as CustomEvent<{ x: number; z: number; clip?: ClipName; seatY?: number; yaw?: number }>).detail;
      const cur = seatRef.current, down = !(cur && cur.x === x && cur.z === z);
      seatRef.current = down ? { x, z, clip, yaw, lift: seatLift(clip, seatY, CHARACTER_SCALE) } : null;
      motion.current.pose = down ? clip : null;
    };
    window.addEventListener("tsi:sit", onSit);
    return () => window.removeEventListener("tsi:sit", onSit);
  }, []);

  useEffect(() => {
    if (frozen) return;
    return bindGameKeys({ keys,
      accepted: ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"],
      onReset: () => { targetRef.current = null; },
      onPress: (event) => event.preventDefault(),
    });
  }, [frozen]);

  useEffect(() => {
    const onTarget = (e: Event) => {
      if (frozen) return;
      const { x, z } = (e as CustomEvent<{ x: number; z: number }>).detail;
      targetRef.current = { x, z };
    };
    window.addEventListener("tsi:interior-move", onTarget);
    return () => window.removeEventListener("tsi:interior-move", onTarget);
  }, [frozen]);

  useFrame((_, elapsed) => {
    const delta = Math.min(elapsed, 0.1);
    if (frozen) targetRef.current = null;
    const p = posRef.current;
    const previousX = p.x, previousZ = p.z;
    let vx = 0, vz = 0;
    const seat = seatRef.current;
    if (seat && !frozen && (keys["w"] || keys["a"] || keys["s"] || keys["d"] || keys["arrowup"] || keys["arrowdown"] || keys["arrowleft"] || keys["arrowright"] || targetRef.current)) {
      seatRef.current = null; motion.current.pose = null;
    } else if (seat) {
      p.x = seat.x; p.z = seat.z;
      Object.assign(motion.current, { speed: 0, yaw: seat.yaw, lift: seat.lift });
      groupRef.current?.position.set(p.x, 0, p.z);
      playerPosRef.current.set(p.x, 0, p.z);
      followInteriorCamera(camera, p.x, p.z, delta);
      return;
    }
    if (!frozen) {
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
      const nx = THREE.MathUtils.clamp(p.x + vx * PLAYER_SPEED * delta, -bounds.halfW + WALK_MARGIN, bounds.halfW - WALK_MARGIN);
      const nz = THREE.MathUtils.clamp(p.z + vz * PLAYER_SPEED * delta, -bounds.halfD + WALK_MARGIN, bounds.halfD - WALK_MARGIN);
      [p.x, p.z] = constrainMove ? constrainMove(p.x, p.z, nx, nz) : [nx, nz];
      onMove(p.x, p.z);
      playerPosRef.current.set(p.x, 0, p.z);
    }

    if (groupRef.current) groupRef.current.position.set(p.x, 0, p.z);
    motion.current.lift = 0;
    motion.current.speed = delta > 0 ? Math.hypot(p.x - previousX, p.z - previousZ) / delta : 0;
    if (moving) motion.current.yaw = easeFacing(motion.current.yaw, Math.atan2(vx, vz), 10, delta);
    followInteriorCamera(camera, p.x, p.z, delta);
  });

  return (
    <group ref={groupRef} position={[bounds.spawn[0], 0, bounds.spawn[1]]}>
      <Character look={look} motion={motion} walkSpeed={PLAYER_SPEED} />
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

const FURNITURE_BASE = "/assets/acnh/furniture";
const RESTORED_PIECES = new Set(["study-desk", "study-chair", "bookshelf", "wooden-chest", "bulletinboard", "antique-clock", "plant-monstera", "plant-yucca", "reading-table"]);
export const pieceUrl = (name: string) => `${FURNITURE_BASE}/${name}.glb${name === "clubhouse-pendant" ? "?v=white-20260917" : RESTORED_PIECES.has(name) ? "?v=hq-textures-20260917" : ""}`;

/**
 * Recolor pipeline (2026-07-25): tint the clone's materials by name.
 * Materials are CLONED before coloring — scene.clone(true) shares
 * materials with the GLTF cache, so mutating in place would repaint
 * every instance of the piece everywhere.
 */
export function applyTint(root: THREE.Object3D, tint: Tint): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const tinted = mats.map((m) => {
      const name = (m.name || "").toLowerCase();
      const slot = Object.keys(tint).find((k) => k !== "*" && name.includes(k.toLowerCase()));
      const hex = slot ? tint[slot] : tint["*"];
      if (!hex) return m;
      const c = m.clone() as THREE.MeshStandardMaterial;
      if (c.color) c.color.set(hex);
      return c;
    });
    mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0];
  });
}

export function Piece({ name, position, rotY = 0, rotX = 0, scale = 0.1, tint, glassMaterial, shadows = false }: { name: string; position: [number, number, number]; rotY?: number; rotX?: number; scale?: number; tint?: Tint | null; glassMaterial?: string | readonly string[]; shadows?: boolean }) {
  const { scene } = useGLTF(pieceUrl(name));
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = shadows;
      object.receiveShadow = shadows;
    });
    // undefined = auto-apply the piece's ruled tint; null = force base.
    const t = tint === null ? undefined : tint ?? PIECE_TINTS[name];
    if (t) applyTint(c, t);
    if (glassMaterial) c.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const adjusted = materials.map(material => {
        if (!(typeof glassMaterial === "string" ? [glassMaterial] : glassMaterial).includes(material.name)) return material;
        const glass = material.clone();
        glass.transparent = true;
        glass.opacity = 0.12;
        glass.depthWrite = false;
        return glass;
      });
      object.material = Array.isArray(object.material) ? adjusted : adjusted[0];
    });
    if (rotX) {
      c.rotation.x = rotX;
      c.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(c);
      const center = bounds.getCenter(new THREE.Vector3());
      c.position.set(-center.x, -bounds.min.y, -center.z);
      const grounded = new THREE.Group();
      grounded.add(c);
      return grounded;
    }
    return c;
  }, [scene, name, tint, rotX, glassMaterial, shadows]);
  return <primitive object={clone} position={position} rotation={[0, rotY, 0]} scale={[scale, scale, scale]} />;
}

export function preloadPieces(names: string[]): void {
  names.forEach((n) => useGLTF.preload(pieceUrl(n)));
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
