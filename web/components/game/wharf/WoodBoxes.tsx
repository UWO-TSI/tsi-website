"use client";

/**
 * Wooden boxes as one instanced mesh (lib/game/wharf.ts WoodBox): the wharf's deck boards and steps, the jetty's
 * ladders. Plain weathered wood (the lane's wood preset: rough, no metal), each box its own tone of it.
 */
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { MATERIAL_PRESETS } from "@/lib/game/modelMaterials";
import type { WoodBox } from "@/lib/game/wharf";

const DARK = new THREE.Color("#6e5137"), LIGHT = new THREE.Color("#a98762");

export default function WoodBoxes({ boxes }: { boxes: readonly WoodBox[] }) {
  const mesh = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({ name: "P_Wood", roughness: MATERIAL_PRESETS.wood.roughness, metalness: 0 });
    material.userData.lookClass = MATERIAL_PRESETS.wood.look;
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, boxes.length);
    const o = new THREE.Object3D(), c = new THREE.Color();
    boxes.forEach((b, i) => {
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(0, b.yaw, 0);
      o.scale.set(b.w, b.h, b.d);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c.lerpColors(DARK, LIGHT, b.tone));
    });
    m.castShadow = m.receiveShadow = true;
    m.computeBoundingSphere();
    return m;
  }, [boxes]);
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.dispose(); }, [mesh]);
  return boxes.length ? <primitive object={mesh} /> : null;
}
