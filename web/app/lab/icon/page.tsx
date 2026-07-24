"use client";

/**
 * /lab/icon — icon render stage (loop iter 10, 2026-07-24). Dev-only.
 * Mounts one GLB on a transparent 128px canvas in profile view;
 * scripts/_render-icons.mjs screenshots the canvas per species to produce
 * the real fish icons (replaces the lost ad-hoc harness).
 * Params: ?model=/assets/acnh/fish/x.glb&raw=1
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

function Subject({ url, raw }: { url: string; raw: boolean }) {
  const { scene } = useGLTF(url);
  const group = useMemo(() => {
    const clone = scene.clone(true);
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    inner.add(clone);
    if (raw) {
      inner.scale.setScalar(0.1);
      inner.rotation.x = Math.PI / 2;
    }
    holder.add(inner);
    // profile view + normalize to ~1.6u so every species fills the frame
    const box = new THREE.Box3().setFromObject(holder);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s = 1.6 / Math.max(size.x, size.y, size.z, 0.001);
    holder.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(holder);
    const c = new THREE.Vector3();
    box2.getCenter(c);
    holder.position.sub(c);
    holder.rotation.y = Math.PI / 2; // face the camera side-on
    return holder;
  }, [scene, raw]);
  return <primitive object={group} />;
}

export default function IconStage() {
  // Client-only mount gate: params come from window, so skip SSR entirely
  // (fixes the hydration mismatch the dev overlay flagged).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  const params = new URLSearchParams(window.location.search);
  const model = params.get("model") ?? "";
  const raw = params.get("raw") === "1";
  if (!model) return <div>?model= required</div>;
  return (
    <div style={{ width: 128, height: 128 }}>
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
