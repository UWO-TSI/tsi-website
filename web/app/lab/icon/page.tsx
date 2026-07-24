"use client";

/**
 * /lab/icon — icon render stage (loop iter 10, 2026-07-24). Dev-only.
 * Mounts one GLB on a transparent 128px canvas in profile view;
 * scripts/_render-icons.mjs screenshots the canvas per species to produce
 * the real fish icons (replaces the lost ad-hoc harness).
 * Params: ?model=/assets/acnh/fish/x.glb&raw=1
 */

import { Suspense, useMemo, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

function Subject({ url, raw }: { url: string; raw: boolean }) {
  const { scene } = useGLTF(url);
  const group = useMemo(() => {
    // SkeletonUtils.clone, NOT scene.clone: the dump fish are SkinnedMeshes,
    // and a plain clone keeps pointing at the ORIGINAL skeleton — the mesh
    // then ignores this holder's scale/rotation entirely (the root cause of
    // the shelved dark-icon batch).
    const clone = cloneSkeleton(scene);
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(clone);
    if (raw) {
      inner.scale.setScalar(0.1);
      inner.rotation.x = Math.PI / 2;
    }
    holder.add(inner);
    // Skinning-aware bounds: the dump fish are SkinnedMeshes whose rendered
    // size comes from the BONES, not the bind-pose geometry — plain
    // Box3.setFromObject reads the wrong extents. computeBoundingBox()
    // samples actual skinned vertex positions.
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
    // profile view + normalize to ~1.6u so every species fills the frame
    const size = new THREE.Vector3();
    measure(holder).getSize(size);
    const s = 1.6 / Math.max(size.x, size.y, size.z, 0.001);
    holder.scale.setScalar(s);
    const c = new THREE.Vector3();
    measure(holder).getCenter(c);
    holder.position.sub(c);
    holder.rotation.y = Math.PI / 2; // face the camera side-on
    // Render-debug breadcrumb for the batch harness (dev-only page).
    console.log("[icon-stage]", JSON.stringify({ size: size.toArray().map((n) => +n.toFixed(3)), scale: +s.toFixed(3) }));
    return holder;
  }, [scene, raw]);
  return <primitive object={group} />;
}

export default function IconStage() {
  // Client-only mount gate: params come from window, so skip SSR entirely
  // (fixes the hydration mismatch the dev overlay flagged).
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  if (!ready) return null;
  const params = new URLSearchParams(window.location.search);
  const model = params.get("model") ?? "";
  const raw = params.get("raw") === "1";
  if (!model) return <div>?model= required</div>;
  return (
    <div style={{ width: 128, height: 128 }}>
      {/* Stage mode: strip every background (incl. the lab layout's dark
          wrapper) so the harness's omitBackground screenshot is truly
          transparent behind the canvas. !important beats inline styles. */}
      <style>{`html, body, body div { background: transparent !important; }`}</style>
      <Canvas
        id="icon-stage"
        dpr={1}
        gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}
        camera={{ fov: 30, position: [0, 0.15, 3.4] }}
        style={{ width: 128, height: 128, background: "transparent" }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <directionalLight position={[-2, 1, -2]} intensity={0.5} />
        <Suspense fallback={null}>
          <Subject url={model} raw={raw} />
        </Suspense>
      </Canvas>
    </div>
  );
}
