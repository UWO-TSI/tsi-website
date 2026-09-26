"use client";

/**
 * Café interior (specs/study-world.md §2): a cozy placeholder from the HQ
 * clubhouse furniture family until David's interior design lands. Warm wood,
 * window light, bookshelves, plants, a counter; the study tables themselves
 * come from lib/study/seats.ts through StudySeats, the wall board opens the
 * top-studiers sheet. The walker is PlayerAvatar so `tsi:sit` works indoors.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import PlayerAvatar from "../PlayerAvatar";
import { InteriorKeeper, Piece, applyInteriorBackdrop } from "../interiorShared";
import { useFollowCamera } from "../IslandAtmosphere";
import StudySeats from "./StudySeats";
import { CLUBHOUSE_LIGHTING } from "@/lib/game/islandLighting";
import type { IslandPhase } from "@/lib/game/islandTime";
import type { WorldIdentity } from "@/lib/game/identity";
import { studySolid } from "@/lib/study/seats";
import world from "../DefaultIslandWorld.module.css";

const HALF_W = 9, HALF_D = 6;
const flat = () => 0;
const DOOR: [number, number] = [0, -5.4];
const SPAWN: [number, number, number] = [0, 0, -4.6];
/** Wall board and where you stand to read it. */
const BOARD: [number, number, number] = [-1.4, 1.28, 5.78];
const BOARD_SPOT: [number, number] = [-1.4, 4.5];
const WINDOWS = [5.6, 2.6];
const GLASS: Record<IslandPhase, string> = { dawn: "#f6d7b8", day: "#cfe8f2", evening: "#f3b98a", night: "#2c3a5c" };
/** Solid non-table furniture: [cx, cz, halfW, halfD]. */
const SOLID: [number, number, number, number][] = [[7.9, -0.95, 0.5, 0.95], [-8.4, 1.3, 0.4, 2.2], [8.1, 5.2, 0.5, 0.5], [-8.1, -4.9, 0.5, 0.5], [-7.4, 5.3, 0.35, 0.35]];

export function constrainCafe(x: number, z: number, nx: number, nz: number): [number, number] {
  const fits = (px: number, pz: number) => Math.abs(px) < HALF_W - 0.7 && pz > -HALF_D + 0.4 && pz < HALF_D - 0.6
    && !studySolid("cafe", px, pz, 0.2) && !SOLID.some(([cx, cz, w, d]) => Math.abs(px - cx) < w + 0.2 && Math.abs(pz - cz) < d + 0.2);
  const steps = Math.max(1, Math.ceil(Math.hypot(nx - x, nz - z) / 0.15));
  const dx = (nx - x) / steps, dz = (nz - z) / steps;
  for (let i = 0; i < steps; i++) {
    if (fits(x + dx, z + dz)) { x += dx; z += dz; }
    else if (fits(x + dx, z)) x += dx;
    else if (fits(x, z + dz)) z += dz;
    else break;
  }
  return [x, z];
}

function Room({ phase }: { phase: IslandPhase }) {
  const wood = useTexture("/assets/acnh/interior/hq-parquet-albedo.png");
  const floor = useMemo(() => {
    const tex = wood.clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1.15, 0.8);
    tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; return tex;
  }, [wood]);
  useEffect(() => () => floor.dispose(), [floor]);
  const wall = "#efe0c4", trim = "#8a5f3c";
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[HALF_W * 2, HALF_D * 2]} /><meshStandardMaterial map={floor} color="#ffe9cf" roughness={0.9} /></mesh>
    {/* North and side walls full height, south a low lip (dollhouse cutaway), warm wainscoting below. */}
    {([[0, 2, HALF_D + 0.15, HALF_W * 2 + 0.6, 4, 0.3], [-HALF_W - 0.15, 2, 0, 0.3, 4, HALF_D * 2 + 0.6], [HALF_W + 0.15, 2, 0, 0.3, 4, HALF_D * 2 + 0.6], [0, 0.5, -HALF_D - 0.15, HALF_W * 2 + 0.6, 1, 0.3]] as const).map(([x, y, z, w, h, d], i) => <group key={i}>
      <mesh position={[x, y, z]}><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={wall} roughness={0.95} /></mesh>
      {i < 3 && <mesh position={[x - Math.sign(x) * 0.16, 0.6, z - Math.sign(z) * 0.16]}><boxGeometry args={[i ? 0.06 : w, 1.2, i ? d : 0.06]} /><meshStandardMaterial color={trim} roughness={0.85} /></mesh>}
    </group>)}
    {/* Window light over the window tables. */}
    {WINDOWS.map(x => <group key={x} position={[x, 2.3, HALF_D - 0.02]}>
      <mesh><boxGeometry args={[1.9, 1.5, 0.12]} /><meshStandardMaterial color={trim} roughness={0.8} /></mesh>
      <mesh position={[0, 0, -0.07]}><planeGeometry args={[1.6, 1.2]} /><meshBasicMaterial color={GLASS[phase]} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0, -0.09]}><boxGeometry args={[0.06, 1.2, 0.02]} /><meshStandardMaterial color={trim} /></mesh>
      <pointLight position={[0, 0, -1.2]} color={phase === "night" ? "#9fb4e0" : "#fff1d6"} intensity={phase === "night" ? 2 : 7} distance={5} />
    </group>)}
  </>;
}

export default function CafeInterior({ phase, player, frozen, identity, onMove, onNear }: {
  phase: IslandPhase; player: React.RefObject<THREE.Vector3>; frozen: boolean; identity: WorldIdentity;
  onMove: (position: THREE.Vector3) => void; onNear: (near: "exit" | null) => void;
}) {
  const { scene, camera } = useThree();
  const light = CLUBHOUSE_LIGHTING[phase];
  useEffect(() => applyInteriorBackdrop(scene, "#20170f"), [scene]);
  useEffect(() => { camera.position.set(SPAWN[0], 6.5, SPAWN[2] - 8.5); }, [camera]);
  useFollowCamera(player, 0.82, null);
  const near = useRef<"exit" | null>(null);
  useFrame(() => {
    const next = Math.hypot(player.current.x - DOOR[0], player.current.z - DOOR[1]) < 1.4 ? "exit" : null;
    if (next !== near.current) { near.current = next; onNear(next); }
  });
  return <>
    <ambientLight color="#fff3e2" intensity={light.ambient} />
    <hemisphereLight args={["#ffe9cc", "#9c7a58", light.hemisphere]} />
    <directionalLight color="#fff4df" intensity={light.key} position={[3, 8, -4]} />
    <Suspense fallback={null}><Room phase={phase} /></Suspense>
    <Suspense fallback={null}>
      {[[3.8, 0.9], [-4.6, 0.9], [4.4, -3]].map(([x, z]) => <group key={x} position={[x, 4, z]}>
        <Piece name="clubhouse-pendant" position={[0, 0, 0]} scale={0.06} />
        <pointLight color="#ffdcaa" intensity={light.ceiling * 0.4} distance={6} position={[0, -1, 0]} />
      </group>)}
      <Piece name="bookshelf" position={[-8.5, 0, 0.2]} rotY={-Math.PI / 2} />
      <Piece name="bookshelf" position={[-8.5, 0, 2.4]} rotY={-Math.PI / 2} />
      <Piece name="plant-monstera" position={[8.1, 0, 5.2]} />
      <Piece name="plant-yucca" position={[-8.1, 0, -4.9]} />
      <Piece name="floor-lamp" position={[-7.4, 0, 5.3]} scale={0.115} />
      <Piece name="lounge-rug" position={[-5, 0.012, 4.2]} scale={0.11} />
      <Piece name="counter-register" position={[7.9, 0, -1.4]} rotY={Math.PI / 2} scale={0.12} />
      <Piece name="counter-register" position={[7.9, 0, -0.45]} rotY={Math.PI / 2} scale={0.12} />
      <Piece name="wall-frame" position={[0.9, 2.3, 5.95]} rotY={Math.PI} />
      <Piece name="wall-clock" position={[8.95, 2.6, 2.4]} rotY={-Math.PI / 2} />
      <Piece name="bulletinboard" position={BOARD} scale={0.2} rotY={Math.PI} />
      <Piece name="yellow-message-mat" rotX={Math.PI} rotY={Math.PI} position={[0, 0.015, -5.2]} scale={0.14} />
    </Suspense>
    <pointLight color="#ffdfae" intensity={light.lamp * 0.5} distance={4.8} position={[-7.4, 1.5, 5.3]} />
    <Html position={[BOARD[0], 2.55, BOARD[2] - 0.2]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={world.cue}>Study board</div></Html>
    <InteriorKeeper position={[8.55, 0, -0.95]} rotY={-Math.PI / 2} watch={[7, -0.95]} colors={{ apron: "#7a4f2e", shirt: "#f3e6cf" }} hat="cap" playerPosRef={player as React.MutableRefObject<THREE.Vector3>} />
    <StudySeats area="cafe" player={player} board={BOARD_SPOT} />
    <PlayerAvatar spawnPosition={SPAWN} playerName={identity.display_name} member={identity.member} onMove={onMove} frozen={frozen}
      groundHeight={flat} constrainMove={constrainCafe} />
  </>;
}
