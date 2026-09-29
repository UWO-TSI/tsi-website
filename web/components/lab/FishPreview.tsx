"use client";

/**
 * FishPreview (David ask 2026-07-24) — big orbitable 3D view of a species
 * for the /lab/fishing bench detail pane. Slow turntable, drag to orbit,
 * scroll to zoom.
 *
 * buildFishStage is the shared clone→calibrate→normalize pipeline (also
 * used by /lab/icon): SkeletonUtils clone (dump fish are SkinnedMeshes and
 * a plain clone stays bound to the original skeleton), GAME_CALIBRATION
 * for raw exports, skinning-aware bounds, centered at origin, side profile
 * facing the camera.
 */

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

export function buildFishStage(scene: THREE.Object3D, raw: boolean, fit: number): THREE.Group {
  const clone = cloneSkeleton(scene);
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(clone);
  if (raw) {
    inner.scale.setScalar(0.1);
    inner.rotation.x = Math.PI / 2;
  }
  holder.add(inner);
  // Skinning-aware bounds: rendered size comes from the BONES, not the
  // bind-pose geometry — Box3.setFromObject reads the wrong extents.
  const measure = (root: THREE.Group): THREE.Box3 => {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const skinned = mesh as THREE.SkinnedMesh;
      if (skinned.isSkinnedMesh) {
        skinned.computeBoundingBox();
        box.union(skinned.boundingBox!.clone().applyMatrix4(skinned.matrixWorld));
      } else {
        box.union(new THREE.Box3().setFromObject(mesh));
      }
    });
    return box;
  };
  const size = new THREE.Vector3();
  measure(holder).getSize(size);
  const s = fit / Math.max(size.x, size.y, size.z, 0.001);
  holder.scale.setScalar(s);
  const c = new THREE.Vector3();
  measure(holder).getCenter(c);
  holder.position.sub(c);
  holder.rotation.y = Math.PI / 2; // side profile toward the camera
  return holder;
}

function Model({ url, raw }: { url: string; raw: boolean }) {
  const { scene } = useGLTF(url);
  const group = useMemo(() => buildFishStage(scene, raw, 2.3), [scene, raw]);
  // Lay the fish horizontal, nose left (aquarium view): raw dump models come
  // out of calibration nose-down, repo-native models nose-up.
  return (
    <group rotation-z={raw ? -Math.PI / 2 : Math.PI / 2}>
      <primitive object={group} />
    </group>
  );
}

export default function FishPreview({ model, raw }: { model: string; raw?: boolean }) {
  return (
    <div
      style={{
        height: 260,
        marginBottom: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ fov: 30, position: [0, 0.5, 4.6] }}>
        <ambientLight intensity={1.05} />
        <directionalLight position={[2, 3, 4]} intensity={1.5} />
        <directionalLight position={[-2, 1, -2]} intensity={0.5} />
        <Suspense fallback={null}>
          <Model key={model} url={model} raw={raw ?? false} />
        </Suspense>
        <OrbitControls autoRotate autoRotateSpeed={1.1} enablePan={false} minDistance={2.2} maxDistance={8} />
      </Canvas>
      <span style={{ position: "absolute", bottom: 8, right: 12, fontSize: 9, color: "#8a939a", pointerEvents: "none" }}>
        drag to orbit · scroll to zoom
      </span>
    </div>
  );
}
