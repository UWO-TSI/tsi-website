"use client";

import { isRockModel, rockUrl } from "@/lib/game/rocks";
import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { prepareModel, disposeModelMaterials, applyModelTextures } from "@/lib/game/modelMaterials";
import { shadowClassFor, type ShadowClass } from "@/lib/game/shadows";
import { modelContact, useContactShadow } from "./ContactShadows";
import { propsOf } from "@/lib/game/defaultIsland";
import { BARRIERS, barrierPlacements } from "@/lib/game/barriers";
import { BUSH_MODELS, FLOWER_MODELS, TREE_MODELS, bushParts, flowerParts, mushroomUrl, treeParts, type NaturePart } from "@/lib/game/natureParts";
import { SEASON_BUSHES, SEASON_FLOWERS, SEASON_TREES } from "@/lib/game/seasonalLook";
import { seasonBlend, type Season } from "@/lib/game/season";
import { lodOf } from "@/lib/game/natureLod";
import { objectsOf, type Village } from "@/lib/game/villageMap";
import { BRIDGE_URL, CAMPFIRE_URL, LOG_BENCH_URL, NOTICE_BOARD_URL, STREETLAMP_URL, propUrl } from "@/lib/game/propModels";
import { FENCE_POST_URL, FENCE_RAIL_URL, fencePlacements, isJoinedFence } from "@/lib/game/fences";
import { InstancedModels, type ModelPlacement } from "./InstancedNature";

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
    ...propsOf(v).filter(o => o.model && !isJoinedFence(o)).map((p): ModelPlacement => ({ url: isRockModel(p.model) ? rockUrl(p.model) : propUrl(p.model!), position: [p.x, ground(p.x, p.z), p.z], rotation: p.yaw ?? 0, scale: p.scale ?? 1 })),
    // The connectable fences: a post on each, rails to the posts beside it (lib/game/fences.ts).
    ...fencePlacements(objectsOf("fence", v).filter(isJoinedFence), ground),
    // The natural barriers standing at this drop (lib/game/barriers.ts), where the walker blocks them.
    ...barrierPlacements(v).map((b): ModelPlacement => ({ url: BARRIERS[b.model].url, position: [b.x, ground(b.x, b.z), b.z], rotation: b.yaw, scale: b.scale })),
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

/**
 * A straight run of the connectable fence (lib/game/fences.ts) placed in code, not on the map: n posts from (x0, z0)
 * a cell apart along (dx, dz), joined by their rails. Drawn only (the walker doesn't know it), as the dump fence it
 * replaces was: the museum's boarded door and the ruins gate.
 */
export function FenceLine({ x0, z0, dx, dz, n, ground }: { x0: number; z0: number; dx: number; dz: number; n: number; ground: (x: number, z: number) => number }) {
  const items = useMemo(() => fencePlacements(Array.from({ length: n }, (_, i) => ({ x: x0 + dx * i, z: z0 + dz * i })), ground), [x0, z0, dx, dz, n, ground]);
  return <InstancedModels items={items} />;
}

// ─── Mushroom ───────────────────────────────────────────────────
/** A woods forage node's mushrooms: its species' own cluster (art/nature/build_mushrooms.py), turned by seed. */
export function NatureMushroom({ position, species, seed }: { position: [number, number, number]; species: string; seed: number }) {
  return (
    <Suspense fallback={null}>
      <GLBProp url={mushroomUrl(species)} position={position} rotation={[0, seed * 2.7, 0]} />
    </Suspense>
  );
}

// Art pass pt2: preload the whole world set at module scope so props/trees
// don't pop in one by one after the loading screen ("well produced" = the
// world arrives assembled). Files are 12-350KB each, ~2MB total.
const PRELOAD = [
  // The village's closed bushes, every season's (about 360 KB in all), so a season change doesn't pop them in.
  ...Object.values(SEASON_BUSHES).flat(),
  // Our flowers, every season's (art/trees/build_flowers.py).
  ...new Set(Object.values(SEASON_FLOWERS).flat()),
  // Our trees in today's season, near and far (about 0.6 MB): the other seasons load when the season turns.
  ...SEASON_TREES[seasonBlend().season].flatMap(url => [url, lodOf(url)].filter((u): u is string => !!u)),
  "/assets/acnh/plants/stump.glb",
  STREETLAMP_URL,
  LOG_BENCH_URL,
  "/assets/acnh/props/bench-park.glb",
  "/assets/acnh/props/fountain.glb",
  "/assets/acnh/props/park-clock.glb",
  "/assets/acnh/props/stone-lantern.glb",
  CAMPFIRE_URL,
  NOTICE_BOARD_URL,
  BRIDGE_URL,
  "/assets/acnh/props/fence-country-a.glb",
  FENCE_POST_URL,
  FENCE_RAIL_URL,
  "/assets/acnh/props/fence-log-a.glb",
];
for (const url of PRELOAD) useGLTF.preload(url);
/** The default (ACNH) trees, bushes and flowers: only the applicant island draws them, so it warms them itself. */
export function preloadDefaultNature() {
  for (const url of [...TREE_MODELS, ...BUSH_MODELS, ...FLOWER_MODELS]) useGLTF.preload(url);
}

// ─── Rock ───────────────────────────────────────────────────────
