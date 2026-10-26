"use client";

/**
 * The boat (specs/polish/arrival-wharf.md): ACNH's little motor boat at a pose in its dock's frame, riding the waves
 * (lib/game/wharf.ts floatBoat: the plane the water the shader draws makes under its hull, the dip as someone steps
 * aboard, the bump off the fenders, the nose-up when it goes). Its flag streams downwind (the shared wind, and the wind of its own going) and
 * flutters; its lantern is lit at dusk and through the night; moored, its bow and stern lines run to the pier and
 * tighten and slacken as it rides, and they come off (and go back over) when it leaves (and comes alongside).
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import { windowLit, type IslandLight } from "@/lib/game/islandLighting";
import { worldNow } from "@/lib/game/worldClock";
import { BOAT, MOORED, PIER, SEA_Y, dockToWorld, floatBoat, newBoatPose, newFloat, newRide, type BoatPose, type Dock, type Float, type Ride } from "@/lib/game/wharf";
import { liveWaves } from "@/lib/game/waves";
import { foamRings } from "@/lib/game/foamRings";
import { liveWind } from "../movement/moveFx";
import { RopeLine } from "./ropeLine";

useGLTF.preload(BOAT.url);

/** The flag hangs off its pole at the stern (model units): the pole's foot, and how far the cloth runs aft. */
const FLAG_POLE = new THREE.Vector3(-5.46, 0, -11.52), FLAG_RUN = 7.81;
const FLAG_VERTEX = /* glsl */ `
  float flagW = clamp((${FLAG_POLE.z.toFixed(2)} - position.z) / ${FLAG_RUN.toFixed(2)}, 0.0, 1.0);
  transformed.x += flagW * uFlag.y * sin(6.2831853 * flagW * 1.25 - uFlag.x * 7.5) + flagW * flagW * uFlag.y * 0.35 * sin(uFlag.x * 3.1 + flagW * 4.0);
  transformed.y -= flagW * flagW * uFlag.z;
`;

/** Where the boat lies at world ms `now`, into `out` (moored, or a trip's course). */
export type PoseAt = (now: number, out: BoatPose) => void;
/** After the boat is placed each frame: its pose, how it floats and its group (a trip seats its rider and throws its wake from it). */
export type OnPlaced = (pose: BoatPose, float: Float, group: THREE.Group, now: number, dt: number) => void;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _wind = new THREE.Vector2();
const BOW_LINE = new THREE.Vector3(...BOAT.bowLine), STERN_LINE = new THREE.Vector3(...BOAT.sternLine);
const BOW_CLEAT = new THREE.Vector3(...PIER.bowCleat), STERN_POST = new THREE.Vector3(PIER.sternPost[0] + PIER.postR + 0.02, PIER.sternPost[1], PIER.sternPost[2]);

/** Module scope (the react compiler forbids writing through hook values): one line's frame, from the pier to the boat, `on` 1 made fast to 0 aboard. */
function hangLine(line: RopeLine, pier: THREE.Vector3, boatPoint: THREE.Vector3, group: THREE.Group, rest: number, on: number) {
  line.mesh.visible = on > 0.02;
  if (!line.mesh.visible) return;
  _b.copy(boatPoint).applyMatrix4(group.matrix);
  const off = 1 - on;
  // Coming off, the pier end flies aboard, the line drawn in; going over, the other way.
  _a.copy(pier).lerp(_b, off * 0.92);
  _a.y += 0.35 * Math.sin(Math.PI * off);
  line.update(_a, _b, rest * (1 - 0.7 * off), 0.12 * Math.sin(Math.PI * off));
}

type BoatParts = { model: THREE.Object3D; lantern: THREE.MeshStandardMaterial | null; pivot: THREE.Group; uniform: { value: THREE.Vector3 } };
type BoatLines = { bow: RopeLine; stern: RopeLine; bowRest: number; sternRest: number } | null;
type BoatState = { pose: BoatPose; float: Float; ride: Ride; glow: number; flagYaw: number; lastX: number; lastZ: number; time: number };
/**
 * Module scope (the react compiler forbids writing through hook values): one frame of the boat. Its pose at world now,
 * floated on the waves; the lantern easing with the windows; the flag streaming down the wind it feels (the island's,
 * less the boat's own way) and fluttering harder in more of it; its lines to the pier; then whatever rides it.
 */
/**
 * Where the hull meets the water, as foam rings (v1 water item 3): three circles along its length (the boat's frame, z
 * along; the hull is about 3 long and 2 across), each its radius. Foam while it lies still; under way the wake takes over.
 */
const HULL_RINGS = [[1.05, 0.62], [0.25, 0.86], [-0.6, 0.8]] as const;
const _ring = { x: 0, z: 0 };
function ringHull(rings: readonly number[], dock: Dock, pose: BoatPose) {
  const c = Math.cos(pose.yaw), sn = Math.sin(pose.yaw), still = Math.max(0, 1 - pose.speed / 1.5);
  HULL_RINGS.forEach(([bz, r], i) => {
    dockToWorld(dock, pose.x + bz * sn, pose.z + bz * c, _ring);
    foamRings.move(rings[i], _ring.x, _ring.z);
    foamRings.set(rings[i], { r, strength: still * 0.9 });
  });
}

function placeBoat(g: THREE.Group | null, dock: Dock, light: IslandLight, poseAt: PoseAt, onPlaced: OnPlaced | undefined, parts: BoatParts, lines: BoatLines, s: BoatState, dt: number, rings: readonly number[] | null) {
  if (!g) return;
  const now = worldNow();
  poseAt(now, s.pose);
  // On the plane the waves make under its hull, rocking on its spring (lib/game/wharf.ts floatBoat).
  floatBoat(dock, s.pose, liveWaves, s.float, s.ride, dt);
  g.position.set(s.pose.x + s.float.sway, s.float.y - BOAT.draft, s.pose.z);
  g.rotation.set(s.float.pitch, s.pose.yaw, s.float.roll, "YXZ");
  g.updateMatrix();
  s.glow = THREE.MathUtils.damp(s.glow, windowLit(light), 2, dt);
  if (parts.lantern) parts.lantern.emissiveIntensity = 2.4 * s.glow;
  const w = liveWind(), c = Math.cos(s.pose.yaw + dock.yaw), sn = Math.sin(s.pose.yaw + dock.yaw);
  const vx = dt > 0 ? (s.pose.x - s.lastX) / dt : 0, vz = dt > 0 ? (s.pose.z - s.lastZ) / dt : 0;
  s.lastX = s.pose.x; s.lastZ = s.pose.z;
  // The boat's way through the air, in the world; the wind it feels, into its own frame (x across, z along).
  const dc = Math.cos(dock.yaw), ds = Math.sin(dock.yaw), wvx = vx * dc + vz * ds, wvz = -vx * ds + vz * dc;
  _wind.set(w.x - wvx, w.z - wvz);
  const bx = _wind.x * c - _wind.y * sn, bz = _wind.x * sn + _wind.y * c, felt = Math.hypot(bx, bz);
  if (felt > 0.05) {
    const want = Math.atan2(-bx, -bz), turn = Math.atan2(Math.sin(want - s.flagYaw), Math.cos(want - s.flagYaw));
    s.flagYaw += turn * (1 - Math.exp(-3 * dt)); // the short way round
  }
  parts.pivot.rotation.y = s.flagYaw;
  s.time += dt;
  parts.uniform.value.set(s.time, Math.min(1.4, 0.35 + felt * 0.16), Math.max(0, 1.3 - felt * 0.25));
  if (lines) {
    hangLine(lines.bow, BOW_CLEAT, BOW_LINE, g, lines.bowRest, s.pose.lines);
    hangLine(lines.stern, STERN_POST, STERN_LINE, g, lines.sternRest, s.pose.lines);
  }
  if (rings) ringHull(rings, dock, s.pose);
  onPlaced?.(s.pose, s.float, g, now, dt);
}

export default function Boat({ dock, light, rope, poseAt, onPlaced }: {
  dock: Dock; light: IslandLight;
  /** The pier's rope material, for the lines (none: no lines). */
  rope: THREE.Material | null;
  poseAt: PoseAt; onPlaced?: OnPlaced;
}) {
  const { scene } = useGLTF(BOAT.url);
  const parts = useMemo(() => {
    const model = prepareModel(scene, BOAT.url, undefined, "solid");
    let lantern: THREE.MeshStandardMaterial | null = null, flag: THREE.Mesh | null = null;
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      // It moves every frame: drawn into the moving shadow map, never the cached one (SunShadows).
      mesh.userData.sunCaster = "dynamic";
      const m = mesh.material as THREE.MeshStandardMaterial;
      if (m.name === "StrcKppShip_mat0" && m.emissiveMap) { lantern = m; m.emissive.set("#ffc27a"); m.emissiveIntensity = 0; }
      if (m.name === "StrcKppShip_mat1") flag = mesh;
    });
    // The flag turns about its pole: hang it from a pivot there, and give its cloth the flutter.
    const pivot = new THREE.Group();
    const uniform = { value: new THREE.Vector3() };
    if (flag) {
      const f = flag as THREE.Mesh, m = f.material as THREE.MeshStandardMaterial;
      f.parent?.add(pivot);
      pivot.position.copy(FLAG_POLE);
      pivot.add(f);
      f.position.sub(FLAG_POLE);
      const base = m.onBeforeCompile, key = m.customProgramCacheKey();
      m.onBeforeCompile = (shader, renderer) => {
        base.call(m, shader, renderer);
        shader.uniforms.uFlag = uniform;
        shader.vertexShader = "uniform vec3 uFlag;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${FLAG_VERTEX}`);
      };
      m.customProgramCacheKey = () => `${key}|boat-flag`;
    }
    return { model, lantern: lantern as THREE.MeshStandardMaterial | null, pivot, uniform };
  }, [scene]);
  useEffect(() => () => disposeModelMaterials(parts.model), [parts]);

  const lines = useMemo(() => {
    if (!rope) return null;
    // As much rope as it takes to hang a little slack at the mooring.
    const moored = new THREE.Group();
    moored.position.set(MOORED.x, SEA_Y - BOAT.draft, MOORED.z);
    moored.rotation.set(0, MOORED.yaw, 0);
    moored.updateMatrix();
    const bowRest = BOW_CLEAT.distanceTo(BOW_LINE.clone().applyMatrix4(moored.matrix)) * 1.12;
    const sternRest = STERN_POST.distanceTo(STERN_LINE.clone().applyMatrix4(moored.matrix)) * 1.12;
    return { bow: new RopeLine(rope, 14, 7, 0.022, 0.13, bowRest), stern: new RopeLine(rope, 14, 7, 0.022, 0.13, sternRest), bowRest, sternRest };
  }, [rope]);
  useEffect(() => () => { lines?.bow.dispose(); lines?.stern.dispose(); }, [lines]);

  const group = useRef<THREE.Group>(null);
  const state = useMemo((): BoatState => ({ pose: newBoatPose(), float: newFloat(), ride: newRide(), glow: 0, flagYaw: 0, lastX: 0, lastZ: 0, time: 0 }), []);
  const rings = useRef<number[] | null>(null);
  useEffect(() => {
    const handles = HULL_RINGS.map(() => foamRings.add(0, 0, 0.5, 0));
    rings.current = handles;
    return () => { handles.forEach(h => foamRings.remove(h)); rings.current = null; };
  }, []);
  useFrame((_, raw) => placeBoat(group.current, dock, light, poseAt, onPlaced, parts, lines, state, Math.min(raw, 0.1), rings.current), -5);

  return <>
    <group ref={group} matrixAutoUpdate={false}>
      <primitive object={parts.model} scale={BOAT.scale} />
    </group>
    {lines && <primitive object={lines.bow.mesh} />}
    {lines && <primitive object={lines.stern.mesh} />}
  </>;
}
