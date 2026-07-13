"use client";

/**
 * DistantIsles (2026-07-13) — ACNH's distant-view vista cards on the sea
 * horizon. Three textured silhouette strips (Terrain/distant-view-*) at
 * ~112u radius, each facing the island center. They ride the curved-world
 * bend with the ocean (standard material), so they sink below the visual
 * horizon exactly like the sea they sit on, and the fog band tints them
 * into depth cues rather than sharp props.
 */

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";

const CARDS = [
  { url: "/assets/acnh/props/distant-view-00.glb", azimuthDeg: 35, radius: 112, scale: 0.6 },
  { url: "/assets/acnh/props/distant-view-01.glb", azimuthDeg: 150, radius: 118, scale: 0.55 },
  { url: "/assets/acnh/props/distant-view-02.glb", azimuthDeg: 262, radius: 108, scale: 0.65 },
];
CARDS.forEach((c) => useGLTF.preload(c.url));

function Card({ url, azimuthDeg, radius, scale }: (typeof CARDS)[number]) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const a = (azimuthDeg * Math.PI) / 180;
  const x = Math.sin(a) * radius;
  const z = Math.cos(a) * radius;
  return (
    <primitive
      object={clone}
      position={[x, -0.5, z]}
      rotation={[0, a + Math.PI, 0]}
      scale={[scale, scale, scale]}
    />
  );
}

export default function DistantIsles() {
  return (
    <Suspense fallback={null}>
      {CARDS.map((c) => (
        <Card key={c.url} {...c} />
      ))}
    </Suspense>
  );
}
