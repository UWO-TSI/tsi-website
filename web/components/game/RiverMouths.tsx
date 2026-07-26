"use client";

/**
 * RiverMouths (2026-07-13) — ACNH waterfall units where the river meets
 * the sea, turning the wave-26 "river ends in a floating lip at the rim"
 * follow-up into the game's own answer: the river pours off the sunken
 * beach ring into the ocean.
 *
 * Untextured fall geometry (the game shades these with an animated
 * shader); we tint them foam-white with slight transparency and let the
 * fog band soften them — they sit ~52u out, so they read as distant
 * falls, not hero props.
 */

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const FALLS = [
  { url: "/assets/acnh/props/waterfall-a.glb", pos: [-61.4, -1.55, 2.6] as [number, number, number], rotY: Math.PI / 2 },
  { url: "/assets/acnh/props/waterfall-b.glb", pos: [61.4, -1.55, 3.2] as [number, number, number], rotY: -Math.PI / 2 },
];
FALLS.forEach((f) => useGLTF.preload(f.url));

let _fallMat: THREE.MeshStandardMaterial | null = null;
function getFallMaterial(): THREE.MeshStandardMaterial {
  if (!_fallMat) {
    _fallMat = new THREE.MeshStandardMaterial({
      color: "#DFF2F8",
      roughness: 0.35,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
  }
  return _fallMat;
}

function Fall({ url, pos, rotY }: (typeof FALLS)[number]) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = getFallMaterial();
    });
    return c;
  }, [scene]);
  // nonuniform: the fall unit is 10 raw wide but must span the ~3.8u
  // channel — x stretched, y/z at drop scale (mock-verified).
  return <primitive object={clone} position={pos} rotation={[0, rotY, 0]} scale={[0.38, 0.08, 0.08]} />;
}

export default function RiverMouths() {
  return (
    <Suspense fallback={null}>
      {FALLS.map((f) => (
        <Fall key={f.url} {...f} />
      ))}
    </Suspense>
  );
}
