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
import { buildFishStage } from "@/components/lab/FishPreview";

function Subject({ url, raw, obj }: { url: string; raw: boolean; obj: boolean }) {
  const { scene } = useGLTF(url);
  // Shared clone→calibrate→normalize pipeline (SkeletonUtils clone +
  // skinning-aware bounds) — see buildFishStage for the SkinnedMesh story.
  const group = useMemo(() => {
    const g = buildFishStage(scene, raw, obj ? 1.45 : 1.6);
    if (obj) {
      // Furniture catalog "clay maquette" look: ACNH furniture albedos are
      // gray recolor bases (color lives in ReBody variants / LUT grades),
      // so raw renders come out clinical white. A uniform warm-bone tint
      // reads as an intentional form catalog.
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mm of mats) (mm as THREE.MeshStandardMaterial).color?.multiply(new THREE.Color("#E9DCC2"));
      });
    }
    return g;
  }, [scene, raw, obj]);
  // Head-side-up (David ruling 2026-07-24): raw dump models come out of
  // calibration nose-DOWN, so they get a flip; repo-native models are
  // already head-up and render as-is.
  // view=obj (furniture catalog 2026-07-25): no flip, a 3/4 yaw instead —
  // normalize handles the 10× dump scale, so only rotation matters.
  return (
    <group rotation-z={!obj && raw ? Math.PI : 0} rotation-y={obj ? -0.65 : 0}>
      <primitive object={group} />
    </group>
  );
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
  const obj = params.get("view") === "obj";
  const size = Number(params.get("size") ?? (obj ? 220 : 128));
  if (!model) return <div>?model= required</div>;
  return (
    <div style={{ width: size, height: size }}>
      {/* Stage mode: strip every background (incl. the lab layout's dark
          wrapper) so the harness's omitBackground screenshot is truly
          transparent behind the canvas. !important beats inline styles. */}
      <style>{`html, body, body div { background: transparent !important; }`}</style>
      <Canvas
        id="icon-stage"
        dpr={1}
        gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}
        camera={obj ? { fov: 30, position: [0, 1.3, 3.95], rotation: [-0.32, 0, 0] } : { fov: 30, position: [0, 0.15, 3.4] }}
        style={{ width: size, height: size, background: "transparent" }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 4]} intensity={1.6} />
        <directionalLight position={[-2, 1, -2]} intensity={0.5} />
        <Suspense fallback={null}>
          <Subject url={model} raw={raw} obj={obj} />
        </Suspense>
      </Canvas>
    </div>
  );
}
