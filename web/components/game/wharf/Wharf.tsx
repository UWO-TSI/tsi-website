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
import { BUOYS, DRESSING_URL, FINGER, LANTERNS, PIER, PIER_URL, ROWBOAT, ROWBOATS, ROWBOAT_URL, dockToWorld, floatBuoy, floatRowboat, newFloat, type Dock, type Float } from "@/lib/game/wharf";
import { windowLit } from "@/lib/game/islandLighting";
import { RopeLine } from "./ropeLine";
import { foamRings } from "@/lib/game/foamRings";
import { berthTaken, type TripPlace } from "@/lib/game/boatTrip";
import { myTrip, readMyTrip, subscribeMyTrip } from "@/lib/game/myTrip";
import Boat, { readSwell } from "./Boat";
import { useTripBoat } from "./useTripBoat";

const BUOY_URL = "/assets/acnh/props/buoy.glb";
/** The buoy at the dump's scale, a touch smaller than ACNH's swimming line (a channel marker); its float meets the water this far up its model (its weighted stem hangs below). */
const BUOY_SCALE = 0.085, BUOY_WATERLINE = 0.66;
useGLTF.preload(PIER_URL);
useGLTF.preload(BUOY_URL);
useGLTF.preload(DRESSING_URL);
useGLTF.preload(ROWBOAT_URL);

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

type Moored = { line: RopeLine | null; float: Float };
const _post = new THREE.Vector3(), _bow = new THREE.Vector3(), BOW_RING = new THREE.Vector3(...ROWBOAT.bowRing);
/**
 * One frame of the moored rowboats (module scope: the react compiler forbids writing through hook values): each on the
 * swell, its line from its post to its bow, the foam where its hull meets the water.
 */
function rideMoored(boats: readonly Moored[], groups: readonly (THREE.Group | null)[], rings: readonly (readonly number[])[], dock: Dock) {
  const swell = readSwell(), at = { x: 0, z: 0 };
  boats.forEach((b, i) => {
    const rb = ROWBOATS[i], g = groups[i];
    if (!g) return;
    floatRowboat(dock, rb, swell.t, swell, b.float);
    g.position.set(rb.x + b.float.sway, b.float.y - ROWBOAT.draft, rb.z);
    g.rotation.set(b.float.pitch, rb.yaw, b.float.roll, "YXZ");
    g.updateMatrix();
    if (b.line) b.line.update(_post.set(rb.post[0], FINGER.postTop - 0.06, rb.post[1]), _bow.copy(BOW_RING).applyMatrix4(g.matrix), 0.12, 0);
    const c = Math.cos(rb.yaw), s = Math.sin(rb.yaw);
    [-0.38, 0.32].forEach((along, k) => {
      dockToWorld(dock, rb.x + along * s, rb.z + along * c, at);
      if (rings[i]) foamRings.move(rings[i][k], at.x, at.z);
    });
  });
}

/**
 * The village wharf's dressing (v1 water item 7; references/look/2026-10-13/wharf-creatures-of-the-deep-ref.png): the
 * finger pier off the tip with its posts, the lantern poles (their glass lit with the windows at dusk and night), and
 * the small rowboats moored along the finger, riding the swell on their lines. Foam rings where the posts and hulls
 * meet the water.
 */
function Dressing({ dock, light, rope }: { dock: Dock; light: IslandLight; rope: THREE.Material | null }) {
  const { scene } = useGLTF(DRESSING_URL), { scene: rowboat } = useGLTF(ROWBOAT_URL);
  const dressing = useMemo(() => {
    const model = prepareModel(scene, DRESSING_URL, undefined, "solid");
    let glass: THREE.MeshStandardMaterial | null = null;
    model.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m && !Array.isArray(m) && m.name === "M_LanternGlass") { glass = m; m.emissive.set("#ffc27a"); } });
    return { model, glass: glass as THREE.MeshStandardMaterial | null };
  }, [scene]);
  useEffect(() => () => disposeModelMaterials(dressing.model), [dressing]);
  const glow = windowLit(light);
  useEffect(() => lightLanterns(dressing.glass, glow), [dressing, glow]);
  const boats = useMemo(() => ROWBOATS.map(() => prepareModel(rowboat.clone(), ROWBOAT_URL, undefined, "solid")), [rowboat]);
  useEffect(() => () => boats.forEach(b => disposeModelMaterials(b)), [boats]);
  const moored = useMemo((): Moored[] => ROWBOATS.map(() => ({ line: rope ? new RopeLine(rope, 10, 6, 0.016, 0.13, 0.9) : null, float: newFloat() })), [rope]);
  const groups = useRef<(THREE.Group | null)[]>([]), rings = useRef<number[][]>([]);
  useEffect(() => () => moored.forEach(m => m.line?.dispose()), [moored]);
  // Foam round the finger's posts and the lantern poles (fixed), and round each rowboat's hull (it rides the swell).
  const { x: dockX, z: dockZ, yaw: dockYaw } = dock;
  useEffect(() => {
    const d = { x: dockX, z: dockZ, yaw: dockYaw }, at = { x: 0, z: 0 }, handles: number[] = [];
    for (const x of FINGER.postX) for (const z of [FINGER.z0 - 0.03, FINGER.z1 + 0.03]) { dockToWorld(d, x, z, at); handles.push(foamRings.add(at.x, at.z, FINGER.postR * 1.05, 0.95)); }
    for (const [x, z] of LANTERN_FEET) { dockToWorld(d, x, z, at); handles.push(foamRings.add(at.x, at.z, 0.07, 0.9)); }
    rings.current = ROWBOATS.map(() => [0, 1].map(() => { const h = foamRings.add(0, 0, ROWBOAT.beam * 0.62, 0.8); handles.push(h); return h; }));
    return () => { handles.forEach(h => foamRings.remove(h)); rings.current = []; };
  }, [dockX, dockZ, dockYaw]);
  useFrame(() => rideMoored(moored, groups.current, rings.current, dock));
  return <>
    <primitive object={dressing.model} />
    {boats.map((b, i) => <group key={i} ref={g => { groups.current[i] = g; }} matrixAutoUpdate={false}><primitive object={b} /></group>)}
    {moored.map((m, i) => m.line && <primitive key={i} object={m.line.mesh} />)}
  </>;
}
/** The lanterns' glass, lit with the windows (module scope: the react compiler forbids writing through hook values). */
function lightLanterns(glass: THREE.MeshStandardMaterial | null, lit: number) { if (glass) glass.emissiveIntensity = 2.2 * lit; }
/** The lantern poles' feet (lib/game/wharf.ts LANTERNS). */
const LANTERN_FEET = LANTERNS;

/**
 * `place`: which island's wharf this is. While this player's trip leaves from it or comes in to it, its boat is the
 * trip's (useTripBoat), carrying their avatar; otherwise it lies moored. Others' trips (multiplayer) will be drawn the
 * same way, each on its own boat.
 */
/** `dressed`: the village wharf's finger pier, lanterns and rowboats (v1 water item 7). */
export default function Wharf({ dock, light, place, dressed = false, children }: { dock: Dock; light: IslandLight; place: TripPlace; dressed?: boolean; children?: ReactNode }) {
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
  // Foam where the piles and the buoys meet the water (v1 water item 3); a ring over the beach is never drawn.
  const { x: dockX, z: dockZ, yaw: dockYaw } = dock;
  useEffect(() => {
    const d = { x: dockX, z: dockZ, yaw: dockYaw }, at = { x: 0, z: 0 }, handles: number[] = [];
    for (const side of [-1, 1]) {
      for (const z of PIER.railZ) { dockToWorld(d, side * PIER.postX, z, at); handles.push(foamRings.add(at.x, at.z, PIER.postR * 1.05, 0.95)); }
      for (const z of PIER.underZ) { dockToWorld(d, side * PIER.underX, z, at); handles.push(foamRings.add(at.x, at.z, PIER.postR * 0.9, 0.85)); }
    }
    for (const [x, z] of BUOYS) { dockToWorld(d, x, z, at); handles.push(foamRings.add(at.x, at.z, 0.14, 0.7)); }
    return () => handles.forEach(h => foamRings.remove(h));
  }, [dockX, dockZ, dockYaw]);
  return <group position={[dock.x, 0, dock.z]} rotation={[0, dock.yaw, 0]}>
    <primitive object={pier} />
    {BUOYS.map(([x, z], i) => <Buoy key={i} dock={dock} x={x} z={z} />)}
    <Boat dock={dock} light={light} rope={rope} poseAt={boat.poseAt} onPlaced={boat.onPlaced} />
    {dressed && <Dressing dock={dock} light={light} rope={rope} />}
    {children}
  </group>;
}
