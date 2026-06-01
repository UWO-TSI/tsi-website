/**
 * GLB preload (P15).
 *
 * useGLTF caches by URL after the first load, but the first load happens
 * lazily during Suspense — which means new visitors see the procedural
 * <ACBuilding> fallback flash on top of the real model for ~200-500ms
 * after Canvas mount. Calling useGLTF.preload() at module load (here)
 * kicks the fetch off as soon as the JS bundle parses, so by the time
 * Suspense decides whether to fall back, the GLBs are already in cache.
 *
 * Import this module from GameWorld.tsx — the side effect runs once.
 */

import { useGLTF } from "@react-three/drei";

const BUILDING_GLBS = [
  "/assets/buildings/hq.glb",
  "/assets/buildings/shop.glb",
  "/assets/buildings/oracle_temple.glb",
  "/assets/buildings/house_1.glb",
];

const NATURE_GLBS = [
  "/assets/nature/tree_default.glb",
  "/assets/nature/tree_oak.glb",
  "/assets/nature/tree_detailed.glb",
  "/assets/nature/tree_pineRoundA.glb",
  "/assets/nature/plant_bush.glb",
  "/assets/nature/plant_bushLarge.glb",
  "/assets/nature/plant_bushSmall.glb",
  "/assets/nature/flower_redA.glb",
  "/assets/nature/flower_purpleA.glb",
  "/assets/nature/flower_yellowA.glb",
  "/assets/nature/flower_redB.glb",
  "/assets/nature/flower_purpleB.glb",
];

if (typeof window !== "undefined") {
  // Only preload in the browser. SSR has no useGLTF runtime.
  for (const url of [...BUILDING_GLBS, ...NATURE_GLBS]) {
    useGLTF.preload(url);
  }
}
