"use client";

/**
 * HQ's furnished room (specs/interiors/hq.md, phases 2 and 3: the gallery): the models art/interiors/build_hq.py builds
 * on lib/game/hqLayout.ts's numbers, the aquarium, and the faked lamp light.
 * - The ground floor (ground.glb) always: the walls both storeys high, the entry, the hall, the floor under the arms.
 * - The upper floor (upper.glb), its three parts (the bridge, the left arm, the right arm: hq_upper_0..2) each while the
 *   walker shows it: cut away while you're under it or it stands between the walking camera and you.
 * - The ceiling (ceiling.glb) only for a camera inside the room under it: the walking camera downstairs is inside
 *   (looking down, it never sees it), upstairs it's above it, and from the door it's outside, looking in over the
 *   cut-away near wall. A caster (hq_caster) closes the room for the sun, so daylight comes in only by the windows.
 * The windows show the outside for the time of day (RoomShell's window view). A click on a floor walks you there.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { AudioManager } from "@/lib/game/audio";
import { prepareModel } from "@/lib/game/modelMaterials";
import { applyEnvironment, disposeEnvironment, type EnvPhaseSpec } from "@/lib/game/envLight";
import * as layout from "@/lib/game/hqLayout";
import { HQ, HQ_FLOOR_HEIGHT as F, HQ_ROOM, type HqWalker } from "@/lib/game/hqLayout";
import { hqPools } from "@/lib/game/hqLight";
import { interiorLight } from "@/lib/game/interiorLight";
import type { IslandLight } from "@/lib/game/islandLighting";
import { useOutside, windowViewMaterial } from "../RoomShell";
import Aquarium, { preloadAquarium } from "./Aquarium";
import LampPools from "./LampPools";

const DIR = "/assets/game/interiors/hq/";
const GROUND = `${DIR}ground.glb`, UPPER = `${DIR}upper.glb`, CEILING = `${DIR}ceiling.glb`;
const DEV = process.env.NODE_ENV !== "production";

/**
 * The room's own light field for reflections and fill (the island's sky isn't indoors): a warm dim ceiling, the
 * plaster walls, the walnut floor's bounce. Darker than the shop's: HQ is lit by its lamps.
 */
const HQ_ENV: EnvPhaseSpec = { skyTop: "#e9dccb", skyBottom: "#b9a58e", ground: "#6e4b34", sun: "#ffdcae", intensity: 0.42, sunElev: 0.85, sunAzimuth: 90 };

export function preloadHqRoom() {
  for (const url of [GROUND, UPPER, CEILING]) useGLTF.preload(url);
  preloadAquarium();
}

const CASTER = new THREE.MeshBasicMaterial({ name: "Caster", side: THREE.DoubleSide, colorWrite: false, depthWrite: false });

/** A room model, prepared (the shared presets, look classes, shadows), its panes showing the outside, its caster shadow-only. */
function useRoomModel(url: string): THREE.Object3D {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const model = prepareModel(scene, url);
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = mesh.name || mesh.parent?.name || "";
      if (/^hq_windows/.test(name)) {
        mesh.material = windowViewMaterial();
        mesh.castShadow = mesh.receiveShadow = false;
      } else if (/^hq_caster/.test(name)) {
        // Shadow only (SunShadows draws it into the key light's map; the camera never sees it).
        mesh.material = CASTER;
        mesh.visible = false;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        mesh.userData.casterOnly = true;
      }
    });
    return model;
  }, [scene, url]);
}

/** A click on a floor (downstairs, or the upper floor's top) walks you there; the walls and fittings take none. */
const walkOn = (level: 0 | 1) => (e: ThreeEvent<MouseEvent>) => {
  if (Math.abs(e.point.y - level * F) > 0.3) return;
  e.stopPropagation();
  window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
  AudioManager.playSFX("click");
};

/** The room's reflected fill follows the time of day too: at night most of it goes, and the lamps carry the room. */
function envForDay(scene: THREE.Scene, day: number) { scene.environmentIntensity = HQ_ENV.intensity * (0.3 + 0.7 * day); }
/** The upper floor's parts in its model (hq_upper_0..2), in the layout's order. */
function upperParts(model: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  model.traverse(o => { const m = /^hq_upper_(\d)/.exec(o.name); if (m && !out[+m[1]]) out[+m[1]] = o; });
  return out;
}
/**
 * Module scope (the react compiler forbids writing through hook values): each part of the upper floor, and its lamps'
 * pools, shown or cut away. Dev (the evidence): `__hqHideUpper` takes it all away (the ground floor's plan),
 * `__hqShowUpper` shows it all (the eye-level views, the player parked out of the picture).
 */
function showUpper(walker: HqWalker, parts: readonly THREE.Object3D[], pools: readonly (THREE.Object3D | null)[]) {
  const dev = DEV ? window as { __hqHideUpper?: boolean; __hqShowUpper?: boolean } : {};
  parts.forEach((part, i) => {
    const shown = !dev.__hqHideUpper && (dev.__hqShowUpper || (walker.shown[i] ?? true));
    part.visible = shown;
    if (pools[i]) pools[i].visible = shown;
  });
}
/** Inside the room, under its ceiling. */
const insideRoom = (p: THREE.Vector3) => p.y < 2 * F - 0.05 && Math.abs(p.x) < HQ_ROOM.halfW && Math.abs(p.z) < HQ_ROOM.halfD;
/**
 * The ceiling (and the whole front wall) shows only to a camera inside the room, decided for each render by the camera
 * drawing it. Returns the undo.
 */
function ceilingForCamera(scene: THREE.Scene, ceiling: THREE.Object3D) {
  const before = scene.onBeforeRender;
  const mine: THREE.Scene["onBeforeRender"] = (...args) => { before.apply(scene, args); ceiling.visible = insideRoom(args[2].position); };
  scene.onBeforeRender = mine;
  return () => { if (scene.onBeforeRender === mine) scene.onBeforeRender = before; };
}

export default function HqRoom({ walker, light }: { walker: HqWalker; light: IslandLight }) {
  useOutside(light);
  // The layout's numbers and the walker, for the evidence script's labels and routes (dev only).
  useEffect(() => {
    if (!DEV) return;
    Object.assign(window, { __hqLayout: { ...layout, option: layout.HQ, zones: layout.HQ_ZONES }, __hqWalker: walker });
    return () => { delete (window as { __hqLayout?: unknown }).__hqLayout; delete (window as { __hqWalker?: unknown }).__hqWalker; };
  }, [walker]);
  const { gl, scene } = useThree();
  useEffect(() => { applyEnvironment(gl, scene, HQ_ENV); return () => disposeEnvironment(scene); }, [gl, scene]);
  const ground = useRoomModel(GROUND), upper = useRoomModel(UPPER), ceiling = useRoomModel(CEILING);
  const pools = useMemo(() => hqPools(), []);
  const low = useMemo(() => pools.filter(p => p.level === 0), [pools]);
  const high = useMemo(() => HQ.upper.map((_, i) => pools.filter(p => p.level === 1 && p.part === i)), [pools]);
  const { lamps: gain, day } = interiorLight(light);
  useEffect(() => envForDay(scene, day), [scene, day]);
  const parts = useMemo(() => upperParts(upper), [upper]);
  const poolGroups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => showUpper(walker, parts, poolGroups.current));
  useEffect(() => ceilingForCamera(scene, ceiling), [scene, ceiling]);
  return <group>
    <primitive object={ground} onClick={walkOn(0)} />
    <LampPools pools={low} gain={gain} />
    <Suspense fallback={null}><Aquarium /></Suspense>
    <primitive object={upper} onClick={walkOn(1)} />
    {high.map((list, i) => list.length > 0 && <group key={i} ref={g => { poolGroups.current[i] = g; }}><LampPools pools={list} gain={gain} /></group>)}
    <primitive object={ceiling} />
  </group>;
}
