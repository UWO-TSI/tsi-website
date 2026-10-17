"use client";

/**
 * The fruit on the trees (specs/polish/world-refinement.md §3; lib/game/treeFruit.ts): our own fruit (the held items'
 * models, their parts merged into one mesh as a held item's are) hanging in each fruiting tree's crown, one instanced
 * mesh per kind of fruit, swaying with the canopy and wobbling with a shake of
 * its tree (lib/game/treeShake.ts). A shake lets go of the fruit hanging nearest the shaker (specs/polish/
 * forage-craft-museum.md 2): it falls from where it hung, bounces once, rolls to rest and lies there until it's picked
 * up, when it lifts into the picker's hand; the rest of the crown keeps its fruit for the hour. No setState, no
 * allocation in the frame loop.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { prepareModel, TREE_WIND } from "@/lib/game/modelMaterials";
import { FRUIT_MODEL, fruitScale, hangAt, type FruitTree, type Point } from "@/lib/game/treeFruit";
import { heldTemplate } from "@/lib/game/character/heldMesh";
import { fallAt, type Fall } from "@/lib/game/treeShake";
import type { Drop } from "@/lib/game/forageWorld";
import { liftPose, type Lift } from "@/lib/game/forageLift";

export interface HangingFruit {
  id: string; key: string; tree: FruitTree;
  /** The hang point that fell this hour and was taken (-1: none): it no longer hangs. */
  fallen: number;
  /** The one falling or lying on the ground, waiting to be picked up. */
  drop: Drop | null;
}

const _at: Point = { x: 0, y: 0, z: 0 }, _fall: Fall = { x: 0, y: 0, z: 0, spin: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _axis = new THREE.Vector3();
const _lift = { x: 0, y: 0, z: 0, scale: 1 };

/** Module scope (the react compiler forbids writing through hook values): place every fruit of one kind. */
function tickFruit(mesh: THREE.InstancedMesh | null, fruit: readonly HangingFruit[], radius: number, scale: number, lifts: ReadonlyMap<string, Lift>) {
  if (!mesh) return;
  const time = TREE_WIND.value.x, amp = TREE_WIND.value.y, now = performance.now();
  let i = 0;
  for (let j = 0; j < fruit.length; j++) {
    const f = fruit[j];
    for (let k = 0; k < f.tree.hang.length; k++) {
      let size = scale;
      // A little turn and lean of its own, fixed per fruit.
      _e.set(Math.sin(k * 2.3 + f.tree.x) * 0.25, f.tree.yaw + k * 2.4, Math.cos(k * 1.7 + f.tree.z) * 0.2);
      _q.setFromEuler(_e);
      const drop = f.drop && f.drop.k === k ? f.drop : null;
      if (k === f.fallen && !drop) size = 0;
      else if (drop && time >= drop.t0) {
        fallAt(drop.from, drop.rest, drop.groundY, radius, time - drop.t0, _fall);
        _at.x = _fall.x; _at.y = _fall.y; _at.z = _fall.z;
        // It rolls about the level axis across the way it rolls.
        const dx = drop.rest.x - drop.from.x, dz = drop.rest.z - drop.from.z;
        _axis.set(dz, 0, -dx);
        if (_axis.lengthSq() > 1e-8) _q.premultiply(_q2.setFromAxisAngle(_axis.normalize(), _fall.spin));
        const lift = lifts.get(f.id);
        if (lift && liftPose(lift, now, _lift)) { _at.x = _lift.x; _at.y = _lift.y; _at.z = _lift.z; size *= _lift.scale; }
      } else hangAt(f.tree, k, time, amp, _at);
      mesh.setMatrixAt(i++, _m.compose(_p.set(_at.x, _at.y, _at.z), _q, _s.setScalar(size)));
    }
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
}

function FruitKind({ url, scale, fruit, lifts }: { url: string; scale: number; fruit: readonly HangingFruit[]; lifts: ReadonlyMap<string, Lift> }) {
  const { scene } = useGLTF(url);
  // The model's parts merged into one mesh (skin, stem and leaf in its vertex colours: heldMesh), centred: it hangs in
  // the leaves by its middle, not its base. Hanging, it casts no shadow of its own (the crown's hull does) and nothing
  // under it is ground.
  const { geometry, material, radius } = useMemo(() => {
    let mesh: THREE.Mesh | null = null;
    prepareModel(heldTemplate(scene, url), url, undefined, "none").traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    const src = mesh as unknown as THREE.Mesh;
    const geometry = src.geometry.clone();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!, mid = box.getCenter(new THREE.Vector3());
    geometry.translate(-mid.x, -mid.y, -mid.z);
    return { geometry, material: src.material as THREE.Material, radius: ((box.max.y - box.min.y) / 2) * scale };
  }, [scene, url, scale]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const count = fruit.reduce((n, f) => n + f.tree.hang.length, 0);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useFrame(() => tickFruit(mesh.current, fruit, radius, scale, lifts));
  return <instancedMesh key={count} ref={mesh} args={[geometry, material, Math.max(1, count)]} frustumCulled={false} castShadow={false} />;
}

/** The radius a fallen fruit rests on (about its model's half height at its tree scale; the drop logic keeps it on the ground). */
export const FRUIT_REST_RADIUS = 0.18;

export default function TreeFruit({ fruit, lifts }: { fruit: readonly HangingFruit[]; lifts: ReadonlyMap<string, Lift> }) {
  const kinds = useMemo(() => {
    const byKey = new Map<string, HangingFruit[]>();
    for (const f of fruit) if (FRUIT_MODEL[f.key]) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f]);
    return [...byKey];
  }, [fruit]);
  return <>{kinds.map(([key, list]) => <Suspense key={key} fallback={null}><FruitKind url={FRUIT_MODEL[key]} scale={fruitScale(key)} fruit={list} lifts={lifts} /></Suspense>)}</>;
}
