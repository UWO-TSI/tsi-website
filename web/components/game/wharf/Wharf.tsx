"use client";

/**
 * The wharf, and the home island's pier to match (specs/polish/arrival-wharf.md deliverables 1 and 2): the timber
 * jetty modelled in Blender (art/wharf/build_wharf.py: weathered boards, piles with their wet band and weed, a rope
 * rail hung pile to pile, the end rail at the tip to lean on and fish, fenders, cleats, a coil of line), the boat
 * moored alongside the tip on its lines, and two buoys marking its lane, everything riding the shared swell. Placed
 * on a dock (the wharf landmark's spot and yaw, or the home island's HOME_PIER), in that dock's frame.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import type { IslandLight } from "@/lib/game/islandLighting";
import { BUOYS, PIER_URL, floatBuoy, newFloat, type Dock } from "@/lib/game/wharf";
import { berthTaken, type TripPlace } from "@/lib/game/boatTrip";
import { myTrip, readMyTrip, subscribeMyTrip } from "@/lib/game/myTrip";
import Boat, { readSwell } from "./Boat";
import { useTripBoat } from "./useTripBoat";

const BUOY_URL = "/assets/acnh/props/buoy.glb";
/** The buoy at the dump's scale, a touch smaller than ACNH's swimming line (a channel marker); its float meets the water this far up its model (its weighted stem hangs below). */
const BUOY_SCALE = 0.085, BUOY_WATERLINE = 0.66;
useGLTF.preload(PIER_URL);
useGLTF.preload(BUOY_URL);

/** One buoy on the swell at (x, z) in the dock's frame. Its shadow would fall on the water, which takes none: it casts none. */
function Buoy({ dock, x, z }: { dock: Dock; x: number; z: number }) {
  const { scene } = useGLTF(BUOY_URL);
  const model = useMemo(() => prepareModel(scene, BUOY_URL, undefined, "none"), [scene]);
  useEffect(() => () => disposeModelMaterials(model), [model]);
  const group = useRef<THREE.Group>(null);
  const float = useMemo(() => newFloat(), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const swell = readSwell();
    floatBuoy(dock, x, z, swell.t, swell, float);
    g.position.set(x, float.y - BUOY_WATERLINE, z);
    g.rotation.set(float.pitch, (x * 1.7 + z) % (Math.PI * 2), float.roll, "YXZ");
  });
  return <group ref={group}><primitive object={model} scale={BUOY_SCALE} /></group>;
}

/**
 * `place`: which island's wharf this is. While this player's trip leaves from it or comes in to it, its boat is the
 * trip's (useTripBoat), carrying their avatar; otherwise it lies moored. Others' trips (multiplayer) will be drawn the
 * same way, each on its own boat.
 */
export default function Wharf({ dock, light, place, children }: { dock: Dock; light: IslandLight; place: TripPlace; children?: ReactNode }) {
  const tripKey = useSyncExternalStore(subscribeMyTrip, readMyTrip, () => "");
  const trip = tripKey && berthTaken(myTrip.current, place) ? myTrip.current : null;
  const boat = useTripBoat(trip, dock, light, myTrip.ride);
  const { scene } = useGLTF(PIER_URL);
  const pier = useMemo(() => prepareModel(scene, PIER_URL, undefined, "solid"), [scene]);
  useEffect(() => () => disposeModelMaterials(pier), [pier]);
  // The rail's rope, for the boat's lines: the same rope.
  const rope = useMemo(() => {
    let found: THREE.Material | null = null;
    pier.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !Array.isArray(m) && m.name === "M_Rope") found = m; });
    return found;
  }, [pier]);
  return <group position={[dock.x, 0, dock.z]} rotation={[0, dock.yaw, 0]}>
    <primitive object={pier} />
    {BUOYS.map(([x, z], i) => <Buoy key={i} dock={dock} x={x} z={z} />)}
    <Boat dock={dock} light={light} rope={rope} poseAt={boat.poseAt} onPlaced={boat.onPlaced} />
    {children}
  </group>;
}
