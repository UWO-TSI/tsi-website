"use client";

/**
 * The wharf, and the home island's pier to match (specs/polish/arrival-wharf.md deliverables 1 and 2): the timber
 * jetty modelled in Blender (art/wharf/build_wharf.py: weathered boards, piles with their wet band and weed, a rope
 * rail hung pile to pile, the end rail at the tip to lean on and fish, fenders, cleats, a coil of line), the boat
 * moored alongside the tip on its lines, and two painted buoys marking its lane (art/props/build_buoy.py), everything
 * riding the waves. Placed
 * on a dock (the wharf landmark's spot and yaw, or the home island's HOME_PIER), in that dock's frame.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import type { IslandLight } from "@/lib/game/islandLighting";
import { BUOYS, JETTY, PIER, PIER_URL, dockToWorld, floatBuoy, newFloat, newRide, type Dock, type Float, type Ride } from "@/lib/game/wharf";
import { liveWaves } from "@/lib/game/waves";
import { BUOY_URL, BUOY_WATERLINE } from "@/lib/game/propModels";
import { foamRings } from "@/lib/game/foamRings";
import { berthTaken, type TripPlace } from "@/lib/game/boatTrip";
import { myTrip, readMyTrip, subscribeMyTrip } from "@/lib/game/myTrip";
import Boat from "./Boat";
import { useTripBoat } from "./useTripBoat";

/** Our buoy (art/props/build_buoy.py) at scale 1: its float meets the water BUOY_WATERLINE up its model (its weighted stem hangs below). */
useGLTF.preload(PIER_URL);
useGLTF.preload(BUOY_URL);

/** One buoy on the waves at (x, z) in the dock's frame. Its shadow would fall on the water, which takes none: it casts none. */
function Buoy({ dock, x, z }: { dock: Dock; x: number; z: number }) {
  const { scene } = useGLTF(BUOY_URL);
  const model = useMemo(() => prepareModel(scene, BUOY_URL, undefined, "none"), [scene]);
  useEffect(() => () => disposeModelMaterials(model), [model]);
  const group = useRef<THREE.Group>(null);
  const float = useMemo(() => ({ float: newFloat(), ride: newRide() }), []);
  useFrame((_, raw) => rideBuoy(group.current, dock, x, z, float, Math.min(raw, 0.1)));
  return <group ref={group}><primitive object={model} /></group>;
}

/** Module scope (the react compiler forbids writing through hook values): one frame of a buoy, turned its own way, leaning on the plane of the water under it. */
function rideBuoy(g: THREE.Group | null, dock: Dock, x: number, z: number, b: { float: Float; ride: Ride }, dt: number) {
  if (!g) return;
  const yaw = (x * 1.7 + z) % (Math.PI * 2);
  floatBuoy(dock, x, z, liveWaves, b.float, b.ride, dt, yaw);
  g.position.set(x, b.float.y - BUOY_WATERLINE, z);
  g.rotation.set(b.float.pitch, yaw, b.float.roll, "YXZ");
}

/**
 * `place`: which island's wharf this is. While this player's trip leaves from it or comes in to it, its boat is the
 * trip's (useTripBoat), carrying their avatar; otherwise it lies moored. Others' trips (multiplayer) will be drawn the
 * same way, each on its own boat.
 */
/** A dock with a `y` is the member island's jetty (lib/game/wharf.ts JETTY); without, the plain pier (the home island). */
export default function Wharf({ dock, light, place, children }: { dock: Dock; light: IslandLight; place: TripPlace; children?: ReactNode }) {
  const tripKey = useSyncExternalStore(subscribeMyTrip, readMyTrip, () => "");
  const trip = tripKey && berthTaken(myTrip.current, place) ? myTrip.current : null;
  const boat = useTripBoat(trip, dock, light, myTrip.ride);
  const url = dock.y ? JETTY.url : PIER_URL, { scene } = useGLTF(url);
  const pier = useMemo(() => prepareModel(scene, url, undefined, "solid"), [scene, url]);
  useEffect(() => () => disposeModelMaterials(pier), [pier]);
  // The rail's rope, for the boat's lines: the same rope.
  const rope = useMemo(() => {
    let found: THREE.Material | null = null;
    pier.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && !Array.isArray(m) && m.name === "M_Rope") found = m; });
    return found;
  }, [pier]);
  // Foam where the piles and the buoys meet the water (v1 water item 3); a ring over the beach is never drawn.
  const { x: dockX, z: dockZ, yaw: dockYaw } = dock, jetty = !!dock.y;
  useEffect(() => {
    const d = { x: dockX, z: dockZ, yaw: dockYaw }, at = { x: 0, z: 0 }, handles: number[] = [];
    if (jetty) for (const [x, z] of JETTY.piles) { dockToWorld(d, x, z, at); handles.push(foamRings.add(at.x, at.z, 0.16, 0.95)); }
    else for (const side of [-1, 1]) {
      for (const z of PIER.railZ) { dockToWorld(d, side * PIER.postX, z, at); handles.push(foamRings.add(at.x, at.z, PIER.postR * 1.05, 0.95)); }
      for (const z of PIER.underZ) { dockToWorld(d, side * PIER.underX, z, at); handles.push(foamRings.add(at.x, at.z, PIER.postR * 0.9, 0.85)); }
    }
    // The buoy's float is 0.61 across where it meets the water: the foam laps just outside it.
    for (const [x, z] of BUOYS) { dockToWorld(d, x, z, at); handles.push(foamRings.add(at.x, at.z, 0.33, 0.7)); }
    return () => handles.forEach(h => foamRings.remove(h));
  }, [dockX, dockZ, dockYaw, jetty]);
  return <group position={[dock.x, 0, dock.z]} rotation={[0, dock.yaw, 0]}>
    <primitive object={pier} />
    {BUOYS.map(([x, z], i) => <Buoy key={i} dock={dock} x={x} z={z} />)}
    <Boat dock={dock} light={light} rope={rope} poseAt={boat.poseAt} onPlaced={boat.onPlaced} />
    {children}
  </group>;
}
