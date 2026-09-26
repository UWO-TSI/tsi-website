"use client";

/**
 * Museum interior (decisions 61, 67, 201, 202): aquarium, insect hall and
 * nature room side by side, built from dump display furniture (aquarium tank,
 * glass case, display stand). Cases fill from /api/collections/museum with
 * donor plaques; empty cases never name their species. The curator at the
 * front desk takes donations (DonateSheet) and refuses duplicates.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { InteriorKeeper, InteriorPlayer, Piece, applyInteriorBackdrop, nearestStation, preloadPieces, type InteriorStation, type RoomBounds } from "../interiorShared";
import { GLBProp } from "../NatureModels";
import type { Exhibit, MuseumWing } from "@/lib/collections/logic";
import type { Wing } from "@/lib/collections/roster";
import { ROSTER } from "@/lib/collections/roster";
import styles from "../DefaultIslandWorld.module.css";

preloadPieces(["museum-tank", "museum-case", "museum-stand"]);
const BOUNDS: RoomBounds = { halfW: 9, halfD: 5, spawn: [0, -3.4] };
const CASES_PER_WING = 6;
const WING_X: Record<Wing, number> = { aquarium: 6, insect_hall: 0, nature_room: -6 };
const WING_TITLE: Record<Wing, string> = { aquarium: "Aquarium", insect_hall: "Insect hall", nature_room: "Nature room" };
const WING_FLOOR: Record<Wing, string> = { aquarium: "#bcd6d9", insect_hall: "#d9cfb2", nature_room: "#c9d6b6" };
export const MUSEUM_STATIONS: InteriorStation[] = [
  { id: "curator", name: "Curator", pos: [-2.2, -2.2], action: "donate", range: 1.8 },
  { id: "exit", name: "Outside", pos: [0, -4.2], action: "exit", range: 1.4 },
];
const TANK_GLASS = ["mGlass", "mGlassBack"], CASE_GLASS = ["mGlass", "mGlassR"];
const MODEL = new Map(ROSTER.map(s => [s.key, s.model]));

/** Displayed cases for a wing: donated exhibits first, then empty cases, up to the room's capacity. */
export function wingCases(wing: MuseumWing | undefined, capacity = CASES_PER_WING): Exhibit[] {
  if (!wing) return [];
  return [...wing.exhibits.filter(e => e.donated), ...wing.exhibits.filter(e => !e.donated)].slice(0, capacity);
}

function IconSprite({ url, y, z = 0 }: { url: string; y: number; z?: number }) {
  const tex = useTexture(url);
  return <sprite position={[0, y, z]} scale={[0.85, 0.85, 1]} renderOrder={2}><spriteMaterial map={tex} transparent depthWrite={false} /></sprite>;
}

function Case({ wing, exhibit, x, z }: { wing: Wing; exhibit: Exhibit; x: number; z: number }) {
  const piece = wing === "aquarium" ? "museum-tank" : wing === "insect_hall" ? "museum-case" : "museum-stand";
  const model = exhibit.key ? MODEL.get(exhibit.key) : null;
  // Aquarium fish swim low and near the glass: the tank lid hides the middle from the follow camera.
  const itemY = wing === "aquarium" ? 0.72 : wing === "insect_hall" ? 1.2 : 1.25;
  return <group position={[x, 0, z]}>
    <Suspense fallback={null}><Piece name={piece} position={[0, 0, 0]} scale={wing === "aquarium" ? 0.27 : 0.1} glassMaterial={wing === "aquarium" ? TANK_GLASS : wing === "insect_hall" ? CASE_GLASS : undefined} /></Suspense>
    {exhibit.donated && (model
      ? <Suspense fallback={null}><GLBProp url={model} position={[0, itemY - 0.2, 0]} scale={1.2} castShadow={false} /></Suspense>
      : exhibit.icon ? <Suspense fallback={null}><IconSprite url={exhibit.icon} y={itemY} z={wing === "aquarium" ? -0.38 : 0} /></Suspense> : null)}
    <Html position={[0, 0.25, -0.75]} center distanceFactor={9} zIndexRange={[3, 0]}>
      <div className={styles.plaque} data-empty={!exhibit.donated}>{exhibit.donated ? <><b>{exhibit.name}</b><span>Donated by {exhibit.donor_name}</span></> : <span>Empty case</span>}</div>
    </Html>
  </group>;
}

export default function MuseumInterior({ wings, frozen, player, onNear }: {
  wings: MuseumWing[] | null; frozen: boolean; player: React.RefObject<THREE.Vector3>; onNear: (near: "donate" | "exit" | null) => void;
}) {
  const { scene, camera } = useThree();
  useEffect(() => applyInteriorBackdrop(scene), [scene]);
  useEffect(() => { player.current.set(0, 0, -3.4); camera.position.set(0, 8.4, -10.6); }, [camera, player]);
  const byWing = useMemo(() => new Map((wings ?? []).map(w => [w.wing, w])), [wings]);
  const nearRef = useRef<string | null>(null);
  const onWalk = (x: number, z: number) => {
    const s = nearestStation(MUSEUM_STATIONS, x, z)?.id ?? null;
    if (s !== nearRef.current) { nearRef.current = s; onNear(s === "curator" ? "donate" : s === "exit" ? "exit" : null); }
  };
  // Cases in two rows per wing; keep the centre aisle and the curator desk clear.
  const constrain = (x: number, z: number, nx: number, nz: number): [number, number] => {
    const blocked = (px: number, pz: number) => pz > 0.6 || (Math.abs(px + 2.2) < 1 && Math.abs(pz + 1.3) < 0.6);
    return !blocked(nx, nz) ? [nx, nz] : !blocked(nx, z) ? [nx, z] : !blocked(x, nz) ? [x, nz] : [x, z];
  };
  return <>
    <ambientLight intensity={0.75} color="#fff6ea" />
    <hemisphereLight args={["#e6efff", "#b49f80", 0.55]} />
    <directionalLight intensity={0.7} position={[3, 8, -4]} color="#fff2dc" />
    {(["aquarium", "insect_hall", "nature_room"] as Wing[]).map(wing => {
      const cx = WING_X[wing], cases = wingCases(byWing.get(wing)), w = byWing.get(wing);
      return <group key={wing}>
        <mesh position={[cx, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[6, 10]} /><meshStandardMaterial color={WING_FLOOR[wing]} roughness={0.9} /></mesh>
        <mesh position={[cx, 2, 5]} rotation={[0, Math.PI, 0]}><planeGeometry args={[6, 4]} /><meshStandardMaterial color={wing === "aquarium" ? "#6e9fb0" : wing === "insect_hall" ? "#a6936a" : "#86a177"} roughness={0.95} /></mesh>
        <pointLight position={[cx, 3, 2.6]} intensity={10} distance={8} color="#fff0d6" />
        <Html position={[cx, 3.3, 4.8]} center distanceFactor={10} zIndexRange={[3, 0]}><div className={styles.cue}>{WING_TITLE[wing]} · {w ? `${w.donated}/${w.total}` : "…"}</div></Html>
        {cases.map((exhibit, i) => <Case key={exhibit.slot} wing={wing} exhibit={exhibit} x={cx + 1.8 - (i % 3) * 1.8} z={i < 3 ? 1.6 : 3.8} />)}
      </group>;
    })}
    <mesh position={[-2.2, 0.45, -1.3]}><boxGeometry args={[1.8, 0.9, 0.7]} /><meshStandardMaterial color="#8a6a4a" roughness={0.85} /></mesh>
    <InteriorKeeper position={[-2.2, 0, -0.7]} watch={[0, -3]} colors={{ apron: "#6b8f7a", shirt: "#e8dcc4" }} hat="none" playerPosRef={player as React.MutableRefObject<THREE.Vector3>} />
    <InteriorPlayer frozen={frozen} bounds={BOUNDS} playerPosRef={player as React.MutableRefObject<THREE.Vector3>} onMove={onWalk} constrainMove={constrain} />
  </>;
}
