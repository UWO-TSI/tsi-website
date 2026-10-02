"use client";

/**
 * Ambient fauna on an island (specs/polish/living-village.md deliverable 3): gulls over the sea, butterflies over the
 * flowers and dragonflies along the water by season and hour, crabs on the beach that scuttle off and dig in when you
 * come close, and now and then a fish leaping out at sea with a splash. World state from the shared world clock
 * (lib/game/ambientFauna.ts); drawn for everyone, never catchable.
 *
 * The flyers are instanced per species (one draw per model part) with their wings beating in the vertex shader; the
 * crabs and the three fish models are a handful of meshes moved in one frame loop. No setState, no per-frame
 * allocation.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import Seagulls from "./Seagulls";
import { GLBProp } from "./NatureModels";
import { useMoveParticles } from "./movement/moveFx";
import { worldNow, worldTime } from "@/lib/game/worldClock";
import { torontoHour } from "@/lib/game/islandTime";
import type { Season } from "@/lib/game/season";
import type { IslandWeather } from "@/lib/game/islandWeather";
import { keepOutOfBloom, lookClassFor } from "@/lib/game/modelMaterials";
import { FACE, seedAt, type Recipe } from "@/lib/game/fx/particles";
import {
  FISH_MODELS, gullPerches, seaAt, butterflyAt, crabStep, crabsFor, dragonflyAt, flyerPresence, flyersFor, flyingWeather, leapPose, leapsAt, newCrabState, newFlyerPose, outWeight,
  type Crab, type CrabState, type FaunaSite, type Flyer, type FlyerSpecies, type Leap,
} from "@/lib/game/ambientFauna";

type Ground = (x: number, z: number) => number;

/** The Toronto hour now, read through Intl once a minute and run on from there. */
const hourClock = { at: -Infinity, hour: 0 };
function hourNow(nowMs: number): number {
  if (nowMs - hourClock.at > 60_000 || nowMs < hourClock.at) { hourClock.at = nowMs; hourClock.hour = torontoHour(new Date(nowMs)); }
  return (hourClock.hour + (nowMs - hourClock.at) / 3_600_000) % 24;
}

// ── Flyers ─────────────────────────────────────────────────────────────
/**
 * Wings beat in the vertex shader: past the body (|x| over a hinge), each side turns up about the body's long axis by
 * the instance's `aFlap` (radians), normals with it.
 */
const FLAP_PARS = "attribute float aFlap;\nuniform vec2 uHinge;\n";
const FLAP_NORMAL = `#include <beginnormal_vertex>
  float fSide = position.x < 0.0 ? -1.0 : 1.0;
  float fWing = smoothstep(uHinge.x, uHinge.y, abs(position.x));
  float fAng = aFlap * fWing * fSide, fc = cos(fAng), fs = sin(fAng);
  objectNormal.xy = vec2(objectNormal.x * fc - objectNormal.y * fs, objectNormal.x * fs + objectNormal.y * fc);`;
const FLAP_VERTEX = `#include <begin_vertex>
  {
    float r = abs(transformed.x) - uHinge.x;
    if (r > 0.0) {
      float a = aFlap * fWing;
      transformed.x = fSide * (uHinge.x + r * cos(a));
      transformed.y += r * sin(a);
    }
  }`;

interface FlyerPart { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; flap: THREE.InstancedBufferAttribute }
/** The model's meshes with their node transforms baked in, each with a flapping copy of its material. */
function flyerParts(scene: THREE.Object3D, species: FlyerSpecies, count: number): FlyerPart[] {
  scene.updateMatrixWorld(true);
  const parts: FlyerPart[] = [];
  const box = new THREE.Box3().setFromObject(scene), span = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
  // The hinge: dragonflies' wings start close to their thin body; butterflies' bodies are a little wider.
  const hinge = species.kind === "dragonfly" ? [0.08 * span, 0.2 * span] : [0.07 * span, 0.24 * span];
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const flap = new THREE.InstancedBufferAttribute(new Float32Array(count), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aFlap", flap);
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    const material = source.clone();
    material.side = THREE.DoubleSide;
    material.userData.lookClass = lookClassFor(species.model, material.name);
    material.onBeforeCompile = shader => {
      shader.uniforms.uHinge = { value: new THREE.Vector2(hinge[0], hinge[1]) };
      shader.vertexShader = FLAP_PARS + shader.vertexShader.replace("#include <beginnormal_vertex>", FLAP_NORMAL).replace("#include <begin_vertex>", FLAP_VERTEX);
      keepOutOfBloom(shader);
    };
    material.customProgramCacheKey = () => `flyer-flap-${hinge[0].toFixed(3)}-${hinge[1].toFixed(3)}`;
    parts.push({ geometry, material, flap });
  });
  return parts;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const _pose = newFlyerPose();

/** Module scope (the react compiler forbids writing through hook values): place every flyer and beat its wings. */
function tickFlyers(flyers: readonly Flyer[], parts: readonly FlyerPart[], meshes: readonly (THREE.InstancedMesh | null)[], ground: Ground, weather: number) {
  const t = worldTime(), hour = hourNow(worldNow());
  for (let i = 0; i < flyers.length; i++) {
    const f = flyers[i], w = outWeight(hour, f.species.hours, f.jitter) * flyerPresence(weather, f.seed);
    const pose = f.species.kind === "butterfly" ? butterflyAt(f, t, w, ground, _pose) : dragonflyAt(f, t, w, ground, _pose);
    _m.compose(_p.set(pose.x, pose.y, pose.z), _q.setFromEuler(_e.set(0, pose.yaw, 0)), _s.setScalar(pose.scale));
    for (let k = 0; k < parts.length; k++) {
      meshes[k]?.setMatrixAt(i, _m);
      parts[k].flap.array[i] = pose.flap;
    }
  }
  for (let k = 0; k < parts.length; k++) {
    const mesh = meshes[k];
    if (!mesh) continue;
    mesh.instanceMatrix.needsUpdate = true;
    parts[k].flap.needsUpdate = true;
  }
}

function FlyerSwarm({ species, flyers, ground, presence }: { species: FlyerSpecies; flyers: readonly Flyer[]; ground: Ground; presence: React.RefObject<number> }) {
  const { scene } = useGLTF(species.model);
  const parts = useMemo(() => flyerParts(scene, species, flyers.length), [scene, species, flyers.length]);
  useEffect(() => () => parts.forEach(p => { p.geometry.dispose(); p.material.dispose(); }), [parts]);
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  useFrame(() => tickFlyers(flyers, parts, meshes.current, ground, presence.current));
  return <>{parts.map((p, k) => (
    <instancedMesh key={k} ref={m => { meshes.current[k] = m; }} args={[p.geometry, p.material, flyers.length]} frustumCulled={false} castShadow={false} receiveShadow={false} />
  ))}</>;
}

// ── Crabs ──────────────────────────────────────────────────────────────
/** Module scope, as tickFlyers: step every crab and place its model; a scuttle judders, digging in sinks it under the sand. */
function tickCrabs(crabs: readonly Crab[], states: CrabState[], groups: (THREE.Group | null)[], dt: number, p: THREE.Vector3, ground: Ground, standable: (x: number, z: number) => boolean) {
  const t = worldNow() / 1000;
  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    crabStep(crabs[i], s, t, dt, p.x, p.z, standable);
    const g = groups[i];
    if (!g) continue;
    const jig = s.fleeT >= 0 ? Math.abs(Math.sin(s.fleeT * 40)) * 0.025 : 0;
    g.position.set(s.x, ground(s.x, s.z) - s.sink * 0.16 + jig, s.z);
    g.rotation.y = s.yaw + (s.fleeT >= 0 ? Math.sin(s.fleeT * 31) * 0.12 : 0);
    g.visible = s.sink < 0.98;
  }
}

function Crabs({ crabs, ground, standable, player }: { crabs: readonly Crab[]; ground: Ground; standable: (x: number, z: number) => boolean; player: React.RefObject<THREE.Vector3> }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const states = useRef<CrabState[]>([]);
  useEffect(() => { states.current = crabs.map(newCrabState); }, [crabs]);
  useFrame((_, raw) => tickCrabs(crabs, states.current, groups.current, Math.min(raw, 0.1), player.current, ground, standable));
  return <>{crabs.map((c, i) => (
    <group key={c.seed} ref={g => { groups.current[i] = g; }}>
      {/* Small: a contact shadow only (the Small class). */}
      <Suspense fallback={null}><GLBProp url={c.model} scale={1.5} /></Suspense>
    </group>
  ))}</>;
}

// ── Fish leaping at sea ────────────────────────────────────────────────
const LEAP_SPLASH: Recipe = { sprite: "droplets", count: [4, 5], life: [0.45, 0.6], size: [0.26, 0.34], grow: 1, speed: [0.5, 1.1], spread: Math.PI, up: [1.8, 2.8], gravity: 9.8, drag: 0.8, wind: 0.1, alpha: 0.9, face: FACE.billboard };
const LEAP_RIPPLE: Recipe = { sprite: "ripple", count: [1, 1], life: [0.9, 1.2], size: [0.7, 0.9], grow: 2, speed: [0, 0], spread: 0, up: [0, 0], gravity: 0, drag: 0, wind: 0, alpha: 0.65, face: FACE.ground };
const WATER_Y = -0.078;
/**
 * Gulls circle far out (GULL_OFFSHORE) a little higher than before: from 20-50 units away the follow camera's 34° look
 * still holds a gull at about 4.6 near the top of the frame over the sea; they come in close only to land.
 */
const GULL_ALTITUDE = 4.6;
/** How far round the view focus fish leap (the sea that's on screen). */
const LEAP_RADIUS = 30;

function fishBody(scene: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  scene.traverse(o => { if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh; });
  if (!found) return null;
  const src = found as THREE.Mesh;
  // The rest pose as a plain mesh: a leap is too quick to see the tail bend.
  const mesh = new THREE.Mesh(src.geometry, (src.material as THREE.Material).clone());
  // About half a unit nose to tail.
  src.geometry.computeBoundingBox();
  const len = src.geometry.boundingBox!.max.z - src.geometry.boundingBox!.min.z;
  mesh.scale.setScalar(0.55 / Math.max(0.01, len));
  mesh.visible = false;
  mesh.castShadow = false;
  return mesh;
}

const _arc = { x: 0, y: 0, z: 0, pitch: 0 }, _dir = new THREE.Vector3(), _focus = new THREE.Vector3();
function LeapingFish({ isSea, max }: { isSea: (x: number, z: number) => boolean; max: number }) {
  const gltfs = useGLTF(FISH_MODELS);
  const bodies = useMemo(() => gltfs.map(g => Array.from({ length: max }, () => fishBody(g.scene))), [gltfs, max]);
  const root = useRef<THREE.Group>(null);
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    bodies.flat().forEach(b => b && r.add(b));
    return () => { bodies.flat().forEach(b => { if (b) { r.remove(b); (b.material as THREE.Material).dispose(); } }); };
  }, [bodies]);
  const leaps = useMemo(() => Array.from({ length: max }, (): Leap => ({ x: 0, z: 0, yaw: 0, u: 0, model: 0, t0: 0, id: 0 })), [max]);
  const splashed = useRef(new Map<number, number>());
  const fx = useMoveParticles();
  useFrame(({ camera }) => tickFish(camera, bodies, leaps, isSea, splashed.current, fx.pool));
  return <group ref={root} />;
}
const used = new Int8Array(FISH_MODELS.length);
/** Module scope, as tickFlyers: the leaps on screen now, each fish on its arc, a splash out and back in. */
function tickFish(camera: THREE.Camera, bodies: readonly (readonly (THREE.Mesh | null)[])[], leaps: Leap[], isSea: (x: number, z: number) => boolean, splashed: Map<number, number>, pool: Pool) {
  camera.getWorldPosition(_focus);
  camera.getWorldDirection(_dir);
  // The view ray's meeting with the sea: which part of the world is drawn.
  const k = _dir.y < -0.05 ? Math.min(-_focus.y / _dir.y, 60) : 60;
  const t = worldTime(), n = leapsAt(t, _focus.x + _dir.x * k, _focus.z + _dir.z * k, LEAP_RADIUS, isSea, leaps);
  for (const set of bodies) for (const b of set) if (b) b.visible = false;
  used.fill(0);
  for (let i = 0; i < n; i++) {
    const l = leaps[i], body = bodies[l.model][used[l.model]++];
    if (!body) continue;
    // Splashes: out of the water at u 0, back in at u 1 (once each per leap; joining mid-leap shows no stale splash).
    const done = splashed.get(l.id) ?? 0;
    if (done < 1) { if (l.u < 0.25) splash(pool, l, 0); splashed.set(l.id, 1); }
    if (l.u >= 1 && done < 2) { if (l.u < 1.2) splash(pool, l, 1); splashed.set(l.id, 2); }
    if (l.u > 1) continue;
    leapPose(l, _arc);
    body.visible = true;
    body.position.set(_arc.x, WATER_Y + _arc.y, _arc.z);
    body.rotation.set(-_arc.pitch, l.yaw, 0, "YXZ");
  }
  if (splashed.size > 64) for (const id of splashed.keys()) { splashed.delete(id); if (splashed.size <= 32) break; }
}
type Pool = ReturnType<typeof useMoveParticles>["pool"];
function splash(pool: Pool, l: Leap, end: 0 | 1) {
  const along = (end - 0.5) * 1.3, x = l.x + Math.sin(l.yaw) * along, z = l.z + Math.cos(l.yaw) * along;
  pool.burst(LEAP_SPLASH, x, WATER_Y, z, WATER_Y, 0, 0, 1, 0xd4ecf7, seedAt(x, z, 41 + end));
  pool.burst(LEAP_RIPPLE, x, WATER_Y + 0.01, z, WATER_Y, 0, 0, 1, 0xe4f4fb, seedAt(x, z, 43 + end));
}

// ── Everything together ────────────────────────────────────────────────
export interface FaunaProps {
  site: FaunaSite;
  ground: Ground;
  standable: (x: number, z: number) => boolean;
  /** Gull orbits over the sea round the island. */
  gulls: readonly (readonly [number, number])[];
  /** Spots on the island a gull lands on now and then ([x, surface y, z]: lamp tops, roofs); the water off the shore is added. */
  perches?: readonly (readonly [number, number, number])[];
  player: React.RefObject<THREE.Vector3>;
  /** The drawn surface and the tallest thing at a point (WeatherGround: where rain lands and prints are left). */
  surface?: (x: number, z: number) => number;
  top?: (x: number, z: number) => number;
}

export default function AmbientFauna({ site, ground, standable, gulls, perches, player, season, weather, liteMode }: FaunaProps & { season: Season; weather: IslandWeather; liteMode: boolean }) {
  const flyers = useMemo(() => flyersFor(site, season, liteMode ? { butterflies: 6, dragonflies: 3 } : undefined), [site, season, liteMode]);
  const bySpecies = useMemo(() => {
    const groups = new Map<FlyerSpecies, Flyer[]>();
    for (const f of flyers) groups.set(f.species, [...(groups.get(f.species) ?? []), f]);
    return [...groups];
  }, [flyers]);
  const crabs = useMemo(() => crabsFor(site, liteMode ? 4 : 6), [site, liteMode]);
  const isSea = useMemo(() => (x: number, z: number) => seaAt(site, x, z), [site]);
  // Flyers take cover from rain and snow over a few seconds and come back the same way.
  const presence = useRef(flyingWeather(weather) ? 1 : 0);
  useFrame((_, raw) => { presence.current = THREE.MathUtils.damp(presence.current, flyingWeather(weather) ? 1 : 0, 0.6, Math.min(raw, 0.1)); });
  const anchors = useMemo(() => gulls.map(([x, z]) => [x, z] as [number, number]), [gulls]);
  const landings = useMemo(() => {
    // The anchors ring the island: their middle is the island's.
    const centre: [number, number] = [anchors.reduce((a, [x]) => a + x, 0) / Math.max(1, anchors.length), anchors.reduce((a, [, z]) => a + z, 0) / Math.max(1, anchors.length)];
    return gullPerches(site, anchors, centre, perches);
  }, [site, anchors, perches]);
  return <>
    <Seagulls anchors={anchors} altitude={GULL_ALTITUDE} perches={landings} />
    {bySpecies.map(([species, list]) => <Suspense key={species.key} fallback={null}><FlyerSwarm species={species} flyers={list} ground={ground} presence={presence} /></Suspense>)}
    <Crabs crabs={crabs} ground={ground} standable={standable} player={player} />
    <Suspense fallback={null}><LeapingFish isSea={isSea} max={liteMode ? 1 : 2} /></Suspense>
  </>;
}
