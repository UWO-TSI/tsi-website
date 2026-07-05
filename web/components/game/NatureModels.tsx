"use client";

import { Suspense, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * Kenney Nature Kit GLB model loader.
 * Loads, clones, and renders nature assets with shadows.
 */
function NatureGLB({ url, scale = 1, position, rotation, castShadow = true }: {
  url: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /**
   * When false, the GLB skips the shadow-cast pass. Saves ~1 draw per
   * sub-mesh per frame. Use false for ground props (flowers, mushrooms,
   * small rocks) where the shadow is invisible at game camera distance.
   */
  castShadow?: boolean;
}) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = castShadow;
        (child as THREE.Mesh).receiveShadow = true;
      }
    });
    return c;
  }, [scene, castShadow]);
  return <primitive object={clone} scale={scale} position={position} rotation={rotation} />;
}

// ─── Trees (ACNH revamp 2026-07 — models ship world-scale) ──────
const TREE_MODELS = [
  "/assets/acnh/plants/tree-hardwood-a.glb",
  "/assets/acnh/plants/tree-hardwood-b.glb",
  "/assets/acnh/plants/tree-blossom.glb",
  "/assets/acnh/plants/tree-cedar.glb",
];

export function NatureTree({ position, seed }: { position: [number, number, number]; seed: number }) {
  const url = TREE_MODELS[seed % TREE_MODELS.length];
  const s = 0.85 + (seed % 5) * 0.08;
  const r: [number, number, number] = [0, (seed * 137.5 * Math.PI) / 180, 0];
  return (
    <Suspense fallback={null}>
      <NatureGLB url={url} scale={s} position={position} rotation={r} />
    </Suspense>
  );
}

// ─── Bushes ─────────────────────────────────────────────────────
const BUSH_MODELS = [
  "/assets/acnh/plants/bush-azalea.glb",
  "/assets/acnh/plants/bush-hydrangea.glb",
  "/assets/acnh/plants/bush-holly.glb",
];

export function NatureBush({ position, seed }: { position: [number, number, number]; seed: number }) {
  const url = BUSH_MODELS[seed % BUSH_MODELS.length];
  return (
    <Suspense fallback={null}>
      <NatureGLB url={url} scale={0.9 + (seed % 3) * 0.15} position={position} rotation={[0, seed * 1.3, 0]} />
    </Suspense>
  );
}

// ─── Flowers ────────────────────────────────────────────────────
const FLOWER_MODELS = [
  "/assets/acnh/plants/flower-cosmos.glb",
  "/assets/acnh/plants/flower-lily.glb",
  "/assets/acnh/plants/flower-hyacinth.glb",
  "/assets/acnh/plants/flower-mum.glb",
  "/assets/acnh/plants/flower-rose.glb",
  "/assets/acnh/plants/flower-tulip.glb",
  "/assets/acnh/plants/flower-pansy.glb",
  "/assets/acnh/plants/flower-windflower.glb",
];

export function NatureFlowerCluster({ position, seed }: { position: [number, number, number]; seed: number }) {
  return (
    <group position={position}>
      <Suspense fallback={null}>
        {[0, 1, 2].map((j) => (
          <NatureGLB
            key={j}
            url={FLOWER_MODELS[(seed + j) % FLOWER_MODELS.length]}
            scale={0.8}
            position={[(j - 1) * 0.4, 0, ((j * 7 + seed) % 3 - 1) * 0.3]}
            rotation={[0, j * 2.1, 0]}
            castShadow={false}
          />
        ))}
      </Suspense>
    </group>
  );
}

// ─── Fence ──────────────────────────────────────────────────────
export function NatureFence({ position, variant }: { position: [number, number, number]; variant?: number }) {
  const url = (variant ?? 0) % 2 === 0 ? "/assets/nature/fence_simple.glb" : "/assets/nature/fence_planks.glb";
  return (
    <Suspense fallback={null}>
      <NatureGLB url={url} scale={0.8} position={position} />
    </Suspense>
  );
}

// ─── Mushroom ───────────────────────────────────────────────────
export function NatureMushroom({ position, seed }: { position: [number, number, number]; seed: number }) {
  const url = seed % 2 === 0 ? "/assets/nature/mushroom_red.glb" : "/assets/nature/mushroom_tan.glb";
  return (
    <Suspense fallback={null}>
      <NatureGLB url={url} scale={0.5} position={position} rotation={[0, seed * 2.7, 0]} castShadow={false} />
    </Suspense>
  );
}

// ─── Stump ──────────────────────────────────────────────────────
export function NatureStump({ position }: { position: [number, number, number] }) {
  return (
    <Suspense fallback={null}>
      <NatureGLB url="/assets/acnh/plants/stump.glb" scale={1} position={position} />
    </Suspense>
  );
}

// ─── Rock ───────────────────────────────────────────────────────
export function NatureRock({ position, seed }: { position: [number, number, number]; seed: number }) {
  const url = seed % 2 === 0 ? "/assets/nature/rock_smallA.glb" : "/assets/nature/rock_smallB.glb";
  return (
    <Suspense fallback={null}>
      <NatureGLB url={url} scale={0.5 + (seed % 3) * 0.15} position={position} rotation={[0, seed * 1.9, 0]} castShadow={false} />
    </Suspense>
  );
}
