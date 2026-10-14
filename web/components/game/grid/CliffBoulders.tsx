"use client";

/**
 * The boulders at the foot of the cliffs (lib/game/rocks.ts `cliffBoulders`): a rendering rule, like the cliff pieces,
 * so a repainted cliff moves them. One InstancedMesh per rock model however many stand (6 models at most: 6 draws and
 * their sun-shadow draws on High). Matte: tagged terrain for the look (LookMaterials), so no toy gloss.
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { IslandMap } from "@/lib/game/grid";
import { cliffBoulders, rockUrl, type RockModel, type RockPlacement } from "@/lib/game/rocks";
import { fxOn, useFxBench } from "@/lib/game/perf/fxBench";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

function ModelRocks({ model, rocks, shadows }: { model: RockModel; rocks: RockPlacement[]; shadows: boolean }) {
  const { scene } = useGLTF(rockUrl(model));
  const part = useMemo(() => {
    let found: { geometry: THREE.BufferGeometry; material: THREE.Material } | null = null;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!found && mesh.isMesh) found = { geometry: mesh.geometry, material: mesh.material as THREE.Material };
    });
    const f = found as { geometry: THREE.BufferGeometry; material: THREE.Material } | null;
    if (f) f.material.userData.lookClass = "terrain";
    return f;
  }, [scene]);
  if (!part) return null;
  return (
    <instancedMesh
      args={[part.geometry, part.material, rocks.length]}
      castShadow={shadows}
      receiveShadow
      // Spread over the island: bounds that follow the instances would cull whole runs at once.
      frustumCulled={false}
      ref={(inst) => {
        if (!inst) return;
        rocks.forEach((r, i) => {
          _q.setFromAxisAngle(_up, r.yaw);
          _p.set(r.x, r.y, r.z);
          _s.setScalar(r.scale);
          inst.setMatrixAt(i, _m.compose(_p, _q, _s));
        });
        inst.instanceMatrix.needsUpdate = true;
      }}
    />
  );
}

export default function CliffBoulders({ map, field, shadows = true }: { map: IslandMap; field?: Float32Array; shadows?: boolean }) {
  useFxBench();
  const byModel = useMemo(() => {
    const out = new Map<RockModel, RockPlacement[]>();
    for (const r of cliffBoulders(map, field)) {
      const list = out.get(r.model) ?? [];
      list.push(r);
      out.set(r.model, list);
    }
    return out;
  }, [map, field]);
  if (!fxOn("cliffBoulders")) return null;
  return <group>{[...byModel].map(([model, rocks]) => <ModelRocks key={model} model={model} rocks={rocks} shadows={shadows} />)}</group>;
}
