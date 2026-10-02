"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { prepareModel, disposeModelMaterials, applyModelTextures } from "@/lib/game/modelMaterials";
import { shadowClassFor, type ShadowClass } from "@/lib/game/shadows";
import { modelContact, useContactShadow } from "./ContactShadows";
import { propsOf } from "@/lib/game/defaultIsland";
import { BUSH_MODELS, FLOWER_MODELS, TREE_MODELS, bushParts, flowerParts, treeParts, type NaturePart } from "@/lib/game/natureParts";
import { SEASON_BUSHES, SEASON_FLOWERS, SEASON_TREES } from "@/lib/game/seasonalLook";
import type { Season } from "@/lib/game/season";
import { objectsOf, type Village } from "@/lib/game/villageMap";
import type { ModelPlacement } from "./InstancedNature";

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

export { treeParts, treeScale, treeYaw, type NaturePart } from "@/lib/game/natureParts";

/** A map's trees, bushes, flowers and props as instanced placements, dressed for the season (the village and the movement lab). */
export function sceneryOf(v: Village, ground: (x: number, z: number) => number, season: Season): ModelPlacement[] {
  const at = (kind: "tree" | "bush" | "flower", parts: (seed: number) => NaturePart[]) => objectsOf(kind, v).flatMap(({ x, z, seed = 0 }) => {
    const y = ground(x, z);
    return parts(seed).map((p): ModelPlacement => ({ url: p.url, position: [x + p.offset[0], y + p.offset[1], z + p.offset[2]], rotation: p.yaw, scale: p.scale }));
  });
  return [
    ...at("tree", seed => treeParts(seed, SEASON_TREES[season])),
    ...at("bush", seed => bushParts(seed, SEASON_BUSHES[season])),
    ...(SEASON_FLOWERS[season].length ? at("flower", seed => flowerParts(seed, SEASON_FLOWERS[season])) : []),
    ...propsOf(v).filter(o => o.model).map((p): ModelPlacement => ({ url: `/assets/acnh/props/${p.model}.glb`, position: [p.x, ground(p.x, p.z), p.z], rotation: p.yaw ?? 0, scale: p.scale ?? 1 })),
  ];
}

function Parts({ position, parts }: { position: [number, number, number]; parts: NaturePart[] }) {
  return (
    <group position={position}>
      <Suspense fallback={null}>
        {parts.map((p, j) => <GLBProp key={j} url={p.url} scale={p.scale} position={p.offset} rotation={[0, p.yaw, 0]} />)}
      </Suspense>
    </group>
  );
}

export function NatureTree({ position, seed, models = TREE_MODELS }: { position: [number, number, number]; seed: number; models?: readonly string[] }) {
  return <Parts position={position} parts={treeParts(seed, models)} />;
}

// ─── Bushes ─────────────────────────────────────────────────────
export function NatureBush({ position, seed, models = BUSH_MODELS }: { position: [number, number, number]; seed: number; models?: readonly string[] }) {
  return <Parts position={position} parts={bushParts(seed, models)} />;
}

// ─── Flowers ────────────────────────────────────────────────────
export function NatureFlowerCluster({ position, seed, models = FLOWER_MODELS }: { position: [number, number, number]; seed: number; models?: readonly string[] }) {
  return <Parts position={position} parts={flowerParts(seed, models)} />;
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
