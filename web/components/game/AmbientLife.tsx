"use client";

/**
 * Fireflies (night only), as one instanced system (specs/polish/forage-craft-museum.md 5): the swarm's positions,
 * headings and glows come from lib/game/fireflySwarm.ts (seeded per firefly, on the shared world clock, written into
 * its own typed arrays), drawn as one instanced mesh per part of the firefly's model and one of their glows, the glow
 * our painted pack's (additive, so it reads in the dark). It used to be a model, a sun-texture sprite and a frame loop
 * per firefly, with three arrays allocated for each every frame.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { prepareModel } from "@/lib/game/modelMaterials";
import { FireflySwarm } from "@/lib/game/fireflySwarm";
import { worldTime } from "@/lib/game/worldClock";
import { packMap, spriteQuad } from "./movement/moveFx";

const URL = "/assets/acnh/critters/firefly.glb";
/** The critter model at the size it always flew at (it hangs head down in its file: a quarter turn lays it level). */
const BODY_SCALE = 0.012;
const GLOW_SIZE = 0.17, GLOW_TINT = new THREE.Color("#ffec8b");

interface Part { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }
/** The model's meshes baked into its own frame, level and at its size: one instanced draw each. */
function bodyParts(scene: THREE.Object3D): Part[] {
  const root = prepareModel(scene, URL), base = new THREE.Matrix4().makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeScale(BODY_SCALE, BODY_SCALE, BODY_SCALE));
  root.updateMatrixWorld(true);
  const parts: Part[] = [];
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    parts.push({ geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(base), material: mesh.material });
  });
  return parts;
}

let glowMaterial: THREE.MeshBasicMaterial | null = null;
const glowLook = () => (glowMaterial ??= new THREE.MeshBasicMaterial({ name: "FireflyGlow", map: packMap(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
const GLOW_GEO = spriteQuad("glow", 3, 1);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
/** Module scope (the react compiler forbids writing through hook values): every body and glow where the swarm has it. */
function draw(swarm: FireflySwarm, bodies: (THREE.InstancedMesh | null)[], glow: THREE.InstancedMesh | null, camera: THREE.Camera) {
  const p = swarm.positions;
  for (let b = 0; b < bodies.length; b++) {
    const body = bodies[b];
    if (!body) continue;
    for (let i = 0; i < swarm.count; i++) body.setMatrixAt(i, _m.compose(_p.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), _q.setFromAxisAngle(_up, swarm.yaw[i]), _s.setScalar(1)));
    body.instanceMatrix.needsUpdate = true;
  }
  if (!glow) return;
  // The glows face the camera: one turn for all of them.
  camera.getWorldQuaternion(_q);
  for (let i = 0; i < swarm.count; i++) {
    const k = swarm.glow[i];
    glow.setMatrixAt(i, _m.compose(_p.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), _q, _s.setScalar(GLOW_SIZE * (0.8 + 0.35 * k))));
    glow.setColorAt(i, _c.copy(GLOW_TINT).multiplyScalar(0.35 + 0.75 * k));
  }
  glow.instanceMatrix.needsUpdate = true;
  if (glow.instanceColor) glow.instanceColor.needsUpdate = true;
}

function Swarm({ count, anchors, groundHeight }: { count: number; anchors: readonly (readonly [number, number])[]; groundHeight: (x: number, z: number) => number }) {
  const { scene } = useGLTF(URL);
  const parts = useMemo(() => bodyParts(scene), [scene]);
  useEffect(() => () => parts.forEach(p => p.geometry.dispose()), [parts]);
  const swarm = useMemo(() => new FireflySwarm(count, anchors), [count, anchors]);
  const bodies = useRef<(THREE.InstancedMesh | null)[]>([]);
  const glow = useRef<THREE.InstancedMesh>(null);
  useFrame(({ camera }) => {
    swarm.step(worldTime(), groundHeight);
    draw(swarm, bodies.current, glow.current, camera);
  });
  return <group>
    {parts.map((p, k) => <instancedMesh key={k} ref={m => { bodies.current[k] = m; }} args={[p.geometry, p.material, count]} frustumCulled={false} castShadow={false} />)}
    <instancedMesh ref={glow} args={[GLOW_GEO, glowLook(), count]} frustumCulled={false} renderOrder={4} />
  </group>;
}

export function Fireflies({ count, anchors, groundHeight }: { count: number; anchors: readonly (readonly [number, number])[]; groundHeight: (x: number, z: number) => number }) {
  return <Suspense fallback={null}><Swarm count={count} anchors={anchors} groundHeight={groundHeight} /></Suspense>;
}
