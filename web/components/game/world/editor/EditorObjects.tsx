"use client";

/**
 * The world's objects in the editor, drawn as the game draws them where it can: nature, props and barriers through the
 * game's own instancing (sceneryOf), the buildings and houses as their models, the wharf as the game's jetty; markers
 * (spawns, anchors, bug spots and the rest) as small coloured posts. Plus the placement ghost (its footprint and, for
 * a building, the model) and the selection's outline.
 */
import { Suspense, useEffect, useMemo } from "react";
import * as THREE from "three";
import { ACNHBuilding, ACNHParts, CHALET_VARIANTS } from "../../ACNHBuilding";
import { InstancedModels } from "../../InstancedNature";
import { GLBProp, sceneryOf } from "../../NatureModels";
import { BRIDGE_URL } from "@/lib/game/propModels";
import { Lanterns } from "../../AmbientProps";
import CafeBuilding from "../../study/CafeBuilding";
import Wharf from "../../wharf/Wharf";
import { houseModel, objectFootprint } from "@/lib/game/defaultIsland";
import type { IslandLight } from "@/lib/game/islandLighting";
import type { MapObject, Village } from "@/lib/game/villageMap";
import { terrainHeight, type WorldTerrain } from "@/lib/game/world/terrain";

const MARKER: Partial<Record<MapObject["kind"], string>> = {
  spawn: "#4ad8ff", anchor: "#b892ff", gather: "#8a6ad8", puddle: "#9fc7df", bug: "#f0e36c", shell: "#fff5e0", bottle: "#7fe0d8",
  fitting: "#e59ad8", missions: "#c9a26b", study: "#d4b483", campfire: "#ff6a2a", landmark: "#ff8f4a",
};

/** A building or house model at an object (the game's offsets: the HQ's model stands 2.35 in front of its footprint). */
export function BuildingModel({ o, y, light }: { o: MapObject; y: number; light: IslandLight }) {
  const k = o.scale ?? 1, yaw = o.yaw ?? 0;
  if (o.kind === "house") return <group position={[o.x, y, o.z]} rotation={[0, yaw, 0]} scale={k}><ACNHParts parts={CHALET_VARIANTS[houseModel(o.model).slice(7) as keyof typeof CHALET_VARIANTS]} lit={0} /></group>;
  if (o.kind !== "landmark") return null;
  if (o.id === "hq") return <group position={[o.x + Math.sin(yaw) * -2.35 * k, y, o.z - Math.cos(yaw) * 2.35 * k]} rotation={[0, yaw, 0]} scale={k}><ACNHBuilding id="hq" windowColor="#ffc95a" windowGlow={light.windowGlow} /></group>;
  if (o.id === "shop" || o.id === "oracle") return <group position={[o.x, y, o.z]} rotation={[0, yaw, 0]} scale={k}><ACNHBuilding id={o.id} lit={0} /></group>;
  if (o.id === "museum") return <group position={[o.x, y, o.z]} rotation={[0, yaw, 0]} scale={k}><ACNHParts parts={CHALET_VARIANTS.red} lit={0} /></group>;
  if (o.id === "cafe") return <group position={[o.x, y, o.z]} rotation={[0, yaw, 0]} scale={k}><CafeBuilding state="soon" light={light} /></group>;
  if (o.id === "wharf") return <Wharf dock={{ x: o.x, z: o.z, yaw }} light={light} place="village" dressed />;
  return null;
}

const MODELLED = (o: MapObject) => o.kind === "house" || (o.kind === "landmark" && ["hq", "shop", "oracle", "museum", "cafe", "wharf"].includes(o.id));

function Marker({ o, y, color }: { o: MapObject; y: number; color: string }) {
  return <group position={[o.x, y, o.z]}>
    <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.07, 0.07, 1.2, 6]} /><meshStandardMaterial color="#3a3530" /></mesh>
    <mesh position={[0, 1.3, 0]}><octahedronGeometry args={[0.28]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} /></mesh>
  </group>;
}

/** An object's footprint as a box outline (or a ring for a point), at the ground. */
export function Footprint({ o, y, color }: { o: MapObject; y: number; color: string }) {
  const f = objectFootprint(o), hw = f?.hw ?? 0, hd = f?.hd ?? 0;
  const geo = useMemo(() => new THREE.EdgesGeometry(hw ? new THREE.BoxGeometry(hw * 2, 0.6, hd * 2) : new THREE.CylinderGeometry(0.7, 0.7, 0.1, 20)), [hw, hd]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <group position={[o.x, y + 0.3, o.z]} rotation={[0, o.yaw ?? 0, 0]}>
    <lineSegments geometry={geo} position={f ? [f.cx, 0, f.cz] : [0, -0.25, 0]} renderOrder={20}>
      <lineBasicMaterial color={color} depthTest={false} transparent />
    </lineSegments>
  </group>;
}

export default function EditorObjects({ terrain, objects, light, ghost, selected }: {
  terrain: WorldTerrain; objects: readonly MapObject[]; light: IslandLight;
  /** The placement ghost (an object not yet placed), and whether it is a building. */
  ghost: { o: MapObject; building: boolean } | null;
  selected: MapObject | null;
}) {
  const ground = useMemo(() => (x: number, z: number) => terrainHeight(terrain, x, z), [terrain]);
  // The game's own placement of nature, props and barriers, from a stand-in village holding these objects.
  const scenery = useMemo(() => sceneryOf({ objects } as unknown as Village, ground, "summer"), [objects, ground]);
  const lamps = useMemo(() => objects.filter(o => o.kind === "lamp").map((o): [number, number, number] => [o.x, ground(o.x, o.z), o.z]), [objects, ground]);
  return <>
    <InstancedModels items={scenery} />
    <Lanterns positions={lamps} intensity={0} glow={0} />
    {objects.filter(o => o.kind === "bridge").map(o => <GLBProp key={o.id} url={BRIDGE_URL} position={[o.x, ground(o.x, o.z) - 0.065, o.z]} rotation={[0, o.yaw ?? 0, 0]} />)}
    <Suspense fallback={null}>
      {objects.filter(MODELLED).map(o => <BuildingModel key={`${o.kind}:${o.id}`} o={o} y={ground(o.x, o.z)} light={light} />)}
    </Suspense>
    {objects.filter(o => !MODELLED(o) && MARKER[o.kind]).map(o => <Marker key={`${o.kind}:${o.id}`} o={o} y={ground(o.x, o.z)} color={MARKER[o.kind]!} />)}
    {ghost && <>
      <Footprint o={ghost.o} y={ground(ghost.o.x, ghost.o.z)} color="#7fffd4" />
      {ghost.building ? <Suspense fallback={null}><BuildingModel o={ghost.o} y={ground(ghost.o.x, ghost.o.z)} light={light} /></Suspense> : <Marker o={ghost.o} y={ground(ghost.o.x, ghost.o.z)} color="#7fffd4" />}
    </>}
    {selected && <Footprint o={selected} y={ground(selected.x, selected.z)} color="#ffd166" />}
  </>;
}
