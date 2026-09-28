"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { prepareModel, disposeModelMaterials, applyModelTextures } from "@/lib/game/modelMaterials";
import { shadowClassFor, type ShadowClass } from "@/lib/game/shadows";
import { modelContact, useContactShadow } from "./ContactShadows";

/**
 * GLB model loader (Kenney kits + ACNH pack).
 * Loads, clones, and renders assets with their shadow class (sun shadow and
 * contact, lib/game/shadows.ts). Exported as GLBProp for one-off prop placement.
 */
export function GLBProp({ url, scale = 1, position, rotation, shadow, emissiveIntensity, hideMaterial }: {
  url: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Overrides the URL's shadow class, only where this use is not what the asset is; say why at the call site. */
  shadow?: ShadowClass;
  emissiveIntensity?: number;
  /** Hide sub-meshes using this material name (e.g. a scaffold's tarp). */
  hideMaterial?: string;
}) {
  const { scene } = useGLTF(url);
  const cls = shadow ?? shadowClassFor(url);
  const clone = useMemo(() => prepareModel(scene, url, emissiveIntensity, cls), [scene, url, emissiveIntensity, cls]);
  useContactShadow(clone, useMemo(() => modelContact(clone, url, cls), [clone, url, cls]));
  useEffect(() => {
    clone.traverse((object) => {
      const mesh = object as import("three").Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mesh.visible = !hideMaterial || !materials.some((m) => m.name === hideMaterial);
    });
  }, [clone, hideMaterial]);
  useEffect(() => {
    applyModelTextures(clone, url);
    return () => disposeModelMaterials(clone);
  }, [clone, url]);
  return <primitive object={clone} scale={scale} position={position} rotation={rotation} />;
}

// ─── Trees (ACNH revamp 2026-07 — models ship world-scale) ──────
const TREE_MODELS = [
  "/assets/acnh/plants/tree-hardwood-a.glb",
  "/assets/acnh/plants/tree-hardwood-b.glb",
  "/assets/acnh/plants/tree-blossom.glb",
  "/assets/acnh/plants/tree-cedar.glb",
];

/** `models` swaps the four tree slots (oak a, oak b, blossom, cedar), e.g. for seasonal dressing. */
/** A tree's size from its seed (also where its crown sheds leaves, IslandAtmosphere). */
export const treeScale = (seed: number) => 0.85 + (seed % 5) * 0.08;

export function NatureTree({ position, seed, models = TREE_MODELS }: { position: [number, number, number]; seed: number; models?: readonly string[] }) {
  const url = models[seed % models.length];
  const s = treeScale(seed);
  const r: [number, number, number] = [0, treeYaw(seed), 0];
  return (
    <Suspense fallback={null}>
      <GLBProp url={url} scale={s} position={position} rotation={r} />
    </Suspense>
  );
}

export function treeYaw(seed: number): number {
  // Broadleaf canopies are authored wider than they are deep; a side-on
  // quarter turn makes the leaf cards look like a thin sheet.
  const yaw = seed % TREE_MODELS.length === 3 ? seed * 137.5 : 180 + ((seed % 5) - 2) * 8;
  return (yaw * Math.PI) / 180;
}

// ─── Bushes ─────────────────────────────────────────────────────
const BUSH_MODELS = [
  "/assets/acnh/plants/bush-azalea.glb",
  "/assets/acnh/plants/bush-hydrangea.glb",
  "/assets/acnh/plants/bush-holly.glb",
];

export function NatureBush({ position, seed, models = BUSH_MODELS }: { position: [number, number, number]; seed: number; models?: readonly string[] }) {
  const url = models[seed % models.length];
  return (
    <Suspense fallback={null}>
      <GLBProp url={url} scale={0.9 + (seed % 3) * 0.15} position={position} rotation={[0, seed * 1.3, 0]} />
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

export function NatureFlowerCluster({ position, seed, models = FLOWER_MODELS }: { position: [number, number, number]; seed: number; models?: readonly string[] }) {
  return (
    <group position={position}>
      <Suspense fallback={null}>
        {[0, 1, 2].map((j) => (
          <GLBProp
            key={j}
            url={models[(seed + j) % models.length]}
            scale={0.8}
            position={[(j - 1) * 0.4, 0, ((j * 7 + seed) % 3 - 1) * 0.3]}
            rotation={[0, j * 2.1, 0]}
          />
        ))}
      </Suspense>
    </group>
  );
}

// ─── Fence (ACNH 1-tile segments) ───────────────────────────────
export function NatureFence({ position, variant }: { position: [number, number, number]; variant?: number }) {
  const url = (variant ?? 0) % 2 === 0
    ? "/assets/acnh/props/fence-country-a.glb"
    : "/assets/acnh/props/fence-country-b.glb";
  return (
    <Suspense fallback={null}>
      <GLBProp url={url} scale={1} position={position} />
    </Suspense>
  );
}

// ─── Mushroom ───────────────────────────────────────────────────
export function NatureMushroom({ position, seed }: { position: [number, number, number]; seed: number }) {
  const url = seed % 2 === 0 ? "/assets/nature/mushroom_red.glb" : "/assets/nature/mushroom_tan.glb";
  return (
    <Suspense fallback={null}>
      <GLBProp url={url} scale={0.5} position={position} rotation={[0, seed * 2.7, 0]} />
    </Suspense>
  );
}

// Art pass pt2: preload the whole world set at module scope so props/trees
// don't pop in one by one after the loading screen ("well produced" = the
// world arrives assembled). Files are 12-350KB each, ~2MB total.
const PRELOAD = [
  ...TREE_MODELS,
  ...BUSH_MODELS,
  ...FLOWER_MODELS,
  "/assets/acnh/plants/stump.glb",
  "/assets/acnh/props/streetlamp.glb",
  "/assets/acnh/props/bench-wood.glb",
  "/assets/acnh/props/bench-park.glb",
  "/assets/acnh/props/fountain.glb",
  "/assets/acnh/props/park-clock.glb",
  "/assets/acnh/props/stone-lantern.glb",
  "/assets/acnh/props/campfire.glb",
  "/assets/acnh/props/bulletin-board.glb",
  "/assets/acnh/props/bridge-wooden.glb",
  "/assets/acnh/props/fence-country-a.glb",
  "/assets/acnh/props/fence-log-a.glb",
  // (ambient chalets moved to Building.tsx CHALET_VARIANTS — they are
  // composed from wall + roof + door parts now, and preloaded there)
];
for (const url of PRELOAD) useGLTF.preload(url);

// ─── Rock ───────────────────────────────────────────────────────
export function NatureRock({ position, seed }: { position: [number, number, number]; seed: number }) {
  const url = seed % 2 === 0 ? "/assets/nature/rock_smallA.glb" : "/assets/nature/rock_smallB.glb";
  return (
    <Suspense fallback={null}>
      <GLBProp url={url} scale={0.5 + (seed % 3) * 0.15} position={position} rotation={[0, seed * 1.9, 0]} />
    </Suspense>
  );
}
