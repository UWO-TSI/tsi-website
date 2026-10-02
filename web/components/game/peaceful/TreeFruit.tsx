"use client";

/**
 * The fruit on the trees (specs/polish/world-refinement.md §3; lib/game/treeFruit.ts): ACNH's fruit hanging in each
 * fruiting tree's crown, one instanced mesh per kind of fruit, swaying with the canopy. A shaken tree's fruit falls
 * from where it hung, hops on the ground, rests and shrinks away. No setState, no allocation in the frame loop.
 */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { prepareModel, TREE_WIND } from "@/lib/game/modelMaterials";
import { FRUIT_MODEL, FRUIT_SCALE, dropAt, hangAt, type FruitTree, type Point } from "@/lib/game/treeFruit";

export interface HangingFruit {
  id: string; key: string; tree: FruitTree;
  /** performance.now() when the tree was shaken (its fruit falls), or null while it hangs. */
  shaken: number | null;
}
type Ground = (x: number, z: number) => number;

const _at: Point = { x: 0, y: 0, z: 0 }, _from: Point = { x: 0, y: 0, z: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

/** Module scope (the react compiler forbids writing through hook values): place every fruit of one kind. */
function tickFruit(mesh: THREE.InstancedMesh | null, fruit: readonly HangingFruit[], ground: Ground, radius: number) {
  if (!mesh) return;
  const now = performance.now(), time = TREE_WIND.value.x, amp = TREE_WIND.value.y;
  let i = 0;
  for (const f of fruit) {
    for (let k = 0; k < f.tree.hang.length; k++) {
      let size = FRUIT_SCALE;
      hangAt(f.tree, k, time, amp, _at);
      if (f.shaken !== null) {
        // They let go one after another, not as one.
        const t = (now - f.shaken) / 1000 - k * 0.07;
        if (t > 0) {
          hangAt(f.tree, k, time, 0, _from);
          size *= dropAt(_from, ground(_from.x, _from.z), radius, t, _at);
        }
      }
      // A little turn and lean of its own, fixed per fruit.
      _e.set(Math.sin(k * 2.3 + f.tree.x) * 0.25, f.tree.yaw + k * 2.4, Math.cos(k * 1.7 + f.tree.z) * 0.2);
      mesh.setMatrixAt(i++, _m.compose(_p.set(_at.x, _at.y, _at.z), _q.setFromEuler(_e), _s.setScalar(size)));
    }
  }
  mesh.count = i;
  mesh.instanceMatrix.needsUpdate = true;
}

function FruitKind({ url, fruit, ground }: { url: string; fruit: readonly HangingFruit[]; ground: Ground }) {
  const { scene } = useGLTF(url);
  // The model's one mesh, centred: it hangs in the leaves by its middle, not its base. Hanging, it casts no shadow of
  // its own (the crown's hull does) and nothing under it is ground.
  const { geometry, material, radius } = useMemo(() => {
    let mesh: THREE.Mesh | null = null;
    prepareModel(scene, url, undefined, "none").traverse(o => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
    const src = mesh as unknown as THREE.Mesh;
    const geometry = src.geometry.clone();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!, mid = box.getCenter(new THREE.Vector3());
    geometry.translate(-mid.x, -mid.y, -mid.z);
    return { geometry, material: src.material as THREE.Material, radius: ((box.max.y - box.min.y) / 2) * FRUIT_SCALE };
  }, [scene, url]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  const count = fruit.reduce((n, f) => n + f.tree.hang.length, 0);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useFrame(() => tickFruit(mesh.current, fruit, ground, radius));
  return <instancedMesh key={count} ref={mesh} args={[geometry, material, Math.max(1, count)]} frustumCulled={false} castShadow={false} />;
}

export default function TreeFruit({ fruit, ground }: { fruit: readonly HangingFruit[]; ground: Ground }) {
  const kinds = useMemo(() => {
    const byUrl = new Map<string, HangingFruit[]>();
    for (const f of fruit) {
      const url = FRUIT_MODEL[f.key];
      if (url) byUrl.set(url, [...(byUrl.get(url) ?? []), f]);
    }
    return [...byUrl];
  }, [fruit]);
  return <>{kinds.map(([url, list]) => <Suspense key={url} fallback={null}><FruitKind url={url} fruit={list} ground={ground} /></Suspense>)}</>;
}
