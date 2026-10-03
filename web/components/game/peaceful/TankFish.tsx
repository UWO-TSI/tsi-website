"use client";

/**
 * A donated fish swimming in its museum tank (specs/polish/interiors.md deliverable 4): the species' own model from
 * the fishing catalogue, laid level (the dump models hang head up: turned head first, back up), sized from its real
 * length to fit the tank, lapping low by the front glass with its tail beating (lib/game/tankSwim.ts), on the world
 * clock. Sea creatures keep to the tank floor.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FISH, type FishDef } from "@/lib/game/fishing";
import { tagLookClasses } from "@/lib/game/modelMaterials";
import { hashSeed } from "@/lib/game/character/look";
import { worldTime } from "@/lib/game/worldClock";
import { tankLength, tankSwim, type SwimPose } from "@/lib/game/tankSwim";

const BY_KEY = new Map(FISH.map(f => [f.key, f]));
/** The catalogue entry for a species key, when it has a model to swim. */
export const tankFishDef = (key: string | null): FishDef | null => (key ? BY_KEY.get(key) ?? null : null);

/** Module scope (the react compiler forbids writing through hook values). */
function place(group: THREE.Group | null, body: THREE.Object3D, p: SwimPose) {
  if (!group) return;
  group.position.set(p.x, p.y, p.z);
  group.rotation.y = p.yaw;
  body.rotation.y = p.wag;
}

export default function TankFish({ def }: { def: FishDef }) {
  const { scene } = useGLTF(def.model);
  const body = useMemo(() => {
    const model = tagLookClasses(cloneSkeleton(scene), def.model);
    // Raw dump exports (×10, lying along z) first get the catalogue's calibration so they hang head up like the rest.
    const hang = new THREE.Group();
    if (def.raw) { hang.scale.setScalar(0.1); hang.rotation.x = Math.PI / 2; }
    hang.add(model);
    // Hanging head up (+y), back toward -z: a quarter turn about x lays it level, head first (+z), back up.
    const level = new THREE.Group();
    level.rotation.x = Math.PI / 2;
    level.add(hang);
    level.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(level), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
    const k = tankLength(def.sizeCm) / Math.max(size.z, 1e-3);
    const fit = new THREE.Group();
    level.position.copy(mid).multiplyScalar(-1);
    fit.add(level);
    fit.scale.setScalar(k);
    fit.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; } });
    return fit;
  }, [scene, def]);
  const group = useRef<THREE.Group>(null);
  const seed = useMemo(() => hashSeed(def.key), [def.key]);
  const pose = useRef<SwimPose>({ x: 0, y: 0, z: 0, yaw: 0, wag: 0 });
  useFrame(() => place(group.current, body, tankSwim(worldTime(), seed, def.move.speed, !!def.creature, pose.current)));
  return <group ref={group}><primitive object={body} /></group>;
}
