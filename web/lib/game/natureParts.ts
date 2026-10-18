/**
 * The model(s) a nature spot places, relative to the spot: url, offset, yaw and scale by seed. NatureTree, NatureBush
 * and NatureFlowerCluster (components/game/NatureModels.tsx), the village's instanced nature and the fruit on the
 * trees (VillageLife) all read these, so they match exactly. ACNH models ship world-scale (2026-07 revamp).
 */
import { isCedar } from "./defaultIsland";
import type { Season } from "./season";

export interface NaturePart { url: string; offset: [number, number, number]; yaw: number; scale: number }

/** The dump's trees: the default for callers that pass no season (the applicant island keeps them). */
export const TREE_MODELS = [
  "/assets/acnh/plants/tree-hardwood-a.glb",
  "/assets/acnh/plants/tree-hardwood-b.glb",
  "/assets/acnh/plants/tree-blossom.glb",
  "/assets/acnh/plants/tree-cedar.glb",
];
/**
 * The member world's broadleaf trees (art/trees/build_broadleaf.py, game/remodel-trees): leaf cards over closed clumps
 * on one trunk, in three shapes (a round crown, a wide spreading one, a tall oval), each in four seasons on the same
 * silhouette (cherry blossom in spring), each with a far model for the distance LOD (lib/game/natureLod.ts).
 * SEASON_TREES (seasonalLook.ts) picks the season's.
 */
export const TREE_SHAPES = ["round", "wide", "tall"] as const;
export type TreeShape = (typeof TREE_SHAPES)[number];
/** A broadleaf tree's dress by season: spring is the blossom. */
export const TREE_DRESS = { spring: "blossom", summer: "summer", autumn: "autumn", winter: "winter" } as const;
export const treeUrl = (shape: TreeShape, season: Season, lod: 0 | 1 = 0) => `/assets/game/plants/tree-${shape}-${TREE_DRESS[season]}${lod ? ".lod1" : ""}.glb`;
/** Our cedar (art/trees/build_conifers.py): tiers of fringe cards over closed cones; the snow one wears a lid on each tier. */
export const CEDAR_URL = "/assets/game/plants/conifer-cedar.glb", CEDAR_SNOW_URL = "/assets/game/plants/conifer-cedar-snow.glb";
export const BUSH_MODELS = [
  "/assets/acnh/plants/bush-azalea.glb",
  "/assets/acnh/plants/bush-hydrangea.glb",
  "/assets/acnh/plants/bush-holly.glb",
];
/** The dump's flowers: the default for callers that pass no season (the applicant island keeps them). */
export const FLOWER_MODELS = [
  "/assets/acnh/plants/flower-cosmos.glb",
  "/assets/acnh/plants/flower-lily.glb",
  "/assets/acnh/plants/flower-hyacinth.glb",
  "/assets/acnh/plants/flower-mum.glb",
  "/assets/acnh/plants/flower-rose.glb",
  "/assets/acnh/plants/flower-tulip.glb",
  "/assets/acnh/plants/flower-pansy.glb",
  "/assets/acnh/plants/flower-windflower.glb",
];

/**
 * The member world's flowers (art/trees/build_flowers.py, game/remodel-trees): clumps of three to five stems with petal
 * cards on our painted petal atlas, one per kind (cosmos, hyacinth, lily, mum, pansy, rose, tulip, windflower).
 */
export const flowerUrl = (kind: string) => `/assets/game/plants/flower-${kind.replace(/^flower_/, "")}.glb`;

/** A woods forage node's model by species key (`mushroom_round` etc.): our clusters, art/nature/build_mushrooms.py. */
export const mushroomUrl = (key: string) => `/assets/game/forage/mushroom-${key.replace(/^mushroom_/, "")}.glb`;

/** A tree's size from its seed (also where its crown sheds leaves, IslandAtmosphere). */
export const treeScale = (seed: number) => 0.85 + (seed % 5) * 0.08;

export function treeYaw(seed: number): number {
  // Every crown is closed now (art/trees/build_trees.py), so no tree has to face the camera: a small turn by seed for
  // variety (the oaks keep ACNH's clover toward +z, its back half and ringed lobes elsewhere).
  const yaw = isCedar(seed) ? seed * 137.5 : ((seed % 5) - 2) * 8;
  return (yaw * Math.PI) / 180;
}

export const treeParts = (seed: number, models: readonly string[] = TREE_MODELS): NaturePart[] =>
  [{ url: models[seed % models.length], offset: [0, 0, 0], yaw: treeYaw(seed), scale: treeScale(seed) }];
export const bushParts = (seed: number, models: readonly string[] = BUSH_MODELS): NaturePart[] =>
  [{ url: models[seed % models.length], offset: [0, 0, 0], yaw: seed * 1.3, scale: 0.9 + (seed % 3) * 0.15 }];

/** A flower model is about a tile across at scale 1; a cluster of three at half size stays inside its tile. */
export const FLOWER_SCALE = 0.5, FLOWER_SPREAD = 0.22;
export const flowerParts = (seed: number, models: readonly string[] = FLOWER_MODELS): NaturePart[] =>
  [0, 1, 2].map(j => ({ url: models[(seed + j) % models.length], offset: [(j - 1) * FLOWER_SPREAD, 0, ((j * 7 + seed) % 3 - 1) * FLOWER_SPREAD * 0.9], yaw: j * 2.1, scale: FLOWER_SCALE }));
