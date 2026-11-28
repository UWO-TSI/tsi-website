"use client";

/**
 * FishPreview (David ask 2026-07-24) — big orbitable 3D view of a species
 * for the /lab/fishing bench detail pane. Slow turntable, drag to orbit,
 * scroll to zoom.
 *
 * The fish is laid level by levelFish (TankFish), the one path the tank, the trophy case, the HQ aquarium and the
 * icons share, then turned nose left as the icons are (fish-models round 4, David: "wh yare all the fish upside down":
 * this pane used its own turns, written for the village's frames, and showed every fish in the game's frame, head +y
 * and back -z, belly up).
 */

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { levelFish } from "@/components/game/peaceful/TankFish";

/** A species laid level (head first, back up), `length` long, centred, turned nose left: the bench's side profile. */
export function previewFish(scene: THREE.Object3D, url: string, raw: boolean, length = 2.3): THREE.Group {
  const g = new THREE.Group();
  g.add(levelFish(scene, { model: url, raw }, length));
  g.rotation.y = -Math.PI / 2;
  return g;
}

function Model({ url, raw }: { url: string; raw: boolean }) {
  const { scene } = useGLTF(url);
  const group = useMemo(() => previewFish(scene, url, raw), [scene, url, raw]);
  return <primitive object={group} />;
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
