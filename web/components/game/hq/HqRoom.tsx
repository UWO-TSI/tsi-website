"use client";

/**
 * HQ's furnished room (specs/interiors/hq.md, phase 2): the models art/interiors/build_hq.py builds on
 * lib/game/hqLayout.ts's numbers, the aquarium, and the faked lamp light.
 * - The ground floor (ground.glb) always: the hall's walls both storeys high, the work floor under the mezzanine.
 * - The mezzanine (upper.glb) while the walker shows it: from the hall, never while you're under it.
 * - The ceiling (ceiling.glb) only for a camera under it: the walking camera looks in from above, as through the
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
import { HQ_FLOOR_HEIGHT as F, type HqWalker } from "@/lib/game/hqLayout";
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

/** A click on a floor (downstairs, or the mezzanine's top) walks you there; the walls and fittings take none. */
const walkOn = (level: 0 | 1) => (e: ThreeEvent<MouseEvent>) => {
  if (Math.abs(e.point.y - level * F) > 0.3) return;
  e.stopPropagation();
  window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: e.point.x, z: e.point.z } }));
  AudioManager.playSFX("click");
};

/** The room's reflected fill follows the time of day too: at night most of it goes, and the lamps carry the room. */
function envForDay(scene: THREE.Scene, day: number) { scene.environmentIntensity = HQ_ENV.intensity * (0.3 + 0.7 * day); }
/** Module scope (the react compiler forbids writing through hook values): the mezzanine shown or cut away. */
function showUpper(walker: HqWalker, upper: THREE.Object3D | null) {
  const hide = DEV && (window as { __hqHideUpper?: boolean }).__hqHideUpper;
  if (upper) upper.visible = !hide && (walker.shown[0] ?? true);
}
/**
 * The ceiling shows only to a camera under it, decided for each render by the camera drawing it (the walking camera
 * is above it; an eye-level view, as the evidence's, is under it). Returns the undo.
 */
function ceilingForCamera(scene: THREE.Scene, ceiling: THREE.Object3D) {
  const before = scene.onBeforeRender;
  const mine: THREE.Scene["onBeforeRender"] = (...args) => { before.apply(scene, args); ceiling.visible = args[2].position.y < 2 * F - 0.05; };
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
  const low = useMemo(() => pools.filter(p => p.level === 0), [pools]), high = useMemo(() => pools.filter(p => p.level === 1), [pools]);
  const { lamps: gain, day } = interiorLight(light);
  useEffect(() => envForDay(scene, day), [scene, day]);
  const upperRef = useRef<THREE.Group>(null);
  useFrame(() => showUpper(walker, upperRef.current));
  useEffect(() => ceilingForCamera(scene, ceiling), [scene, ceiling]);
  return <group>
    <primitive object={ground} onClick={walkOn(0)} />
    <LampPools pools={low} gain={gain} />
    <Suspense fallback={null}><Aquarium /></Suspense>
    <group ref={upperRef}>
      <primitive object={upper} onClick={walkOn(1)} />
      <LampPools pools={high} gain={gain} />
    </group>
    <primitive object={ceiling} />
  </group>;
}
