"use client";

/**
 * Landmarks (2026-07-13) — wayfinding anchors from Furniture/: a red-and-
 * white lighthouse on the southeast shore and a retro windmill on the
 * northwest field. Big silhouettes readable from across the island; the
 * windmill blades spin lazily (one ref rotation — the only animation).
 */

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { getTerrainHeight } from "./terrain";

const LIGHTHOUSE_URL = "/assets/acnh/furniture/lighthouse.glb";
const WINDMILL_URL = "/assets/acnh/furniture/windmill-retro.glb";
useGLTF.preload(LIGHTHOUSE_URL);
useGLTF.preload(WINDMILL_URL);

function Lighthouse() {
  const { scene } = useGLTF(LIGHTHOUSE_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const y = getTerrainHeight(34, -33);
  return <primitive object={clone} position={[34, y, -33]} rotation={[0, Math.PI / 4, 0]} scale={[0.16, 0.16, 0.16]} />;
}

function Windmill() {
  const { scene } = useGLTF(WINDMILL_URL);
  const clone = useMemo(() => scene.clone(true), [scene]);
  const y = getTerrainHeight(-30, 22);
  // Static piece: blade spin needs a sub-node split in the extraction —
  // logged as a nice-to-have.
  return (
    <group position={[-30, y, 22]} rotation={[0, Math.PI / 3, 0]} scale={[0.14, 0.14, 0.14]}>
      <primitive object={clone} />
    </group>
  );
}

export default function Landmarks() {
  return (
    <Suspense fallback={null}>
      <Lighthouse />
      <Windmill />
    </Suspense>
  );
}
