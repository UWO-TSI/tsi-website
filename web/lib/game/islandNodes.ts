/**
 * Foraging and bug node placement for the village core and the home island,
 * derived from each island's own layout data (trees, rocks, flowers, beach
 * band, river banks) so nodes move with the layout.
 */
import type { NodeSpec } from "@/components/game/peaceful/VillageLife";
import { ISLAND_FLOWERS, ISLAND_PROPS, ISLAND_RADII, ISLAND_TREES, createDefaultIsland } from "./defaultIsland";
import { HOME_FLOWERS, HOME_RADII, HOME_TREES, createHomeIsland } from "./homeIsland";
import { isGroundAtWorld } from "./grid";

/** Village tree seeds (DefaultIslandWorld TREE_SEEDS): seed % 4 === 3 is a cedar, which bears no fruit. */
const VILLAGE_TREE_SEEDS = [0, 3, 2, 5, 7, 8, 1, 3];
const beachRing = (radii: { x: number; z: number }, count: number, r = 0.92, phase = 0.4): [number, number][] =>
  Array.from({ length: count }, (_, i) => { const a = phase + (i / count) * Math.PI * 2; return [Math.cos(a) * radii.x * r, Math.sin(a) * radii.z * r]; });

export function villageNodes(): { forage: NodeSpec[]; bugs: NodeSpec[] } {
  const fruit = ISLAND_TREES.filter((_, i) => VILLAGE_TREE_SEEDS[i % VILLAGE_TREE_SEEDS.length] % 4 !== 3)
    .map(([x, z], i): NodeSpec => ({ id: `fruit-${i}`, x, z: z - 0.9, biomes: ["trees"], categories: ["fruit"], canopy: true }));
  const land = createDefaultIsland().map;
  const shells = beachRing(ISLAND_RADII, 8).filter(([x, z]) => z < 12 && isGroundAtWorld(land, x, z)).map(([x, z], i): NodeSpec => ({ id: `shell-${i}`, x, z, biomes: ["beach"], categories: ["nature", "fruit"] }));
  const rocks = ISLAND_PROPS.filter(p => p.model.startsWith("rock")).map((p, i): NodeSpec => ({ id: `rock-${i}`, x: p.x, z: p.z - 0.9, biomes: ["rocks"], categories: ["mineral"] }));
  const woods = ISLAND_TREES.slice(0, 4).map(([x, z], i): NodeSpec => ({ id: `mush-${i}`, x: x + 0.9, z: z - 0.4, biomes: ["woods"], categories: ["nature"] }));
  const flowers = ISLAND_FLOWERS.slice(0, 6).map(([x, z], i): NodeSpec => ({ id: `flower-${i}`, x: x + 0.7, z: z - 0.6, biomes: ["flowers"], categories: ["nature"] }));
  const bugs: NodeSpec[] = [
    ...ISLAND_FLOWERS.slice(6, 12).map(([x, z], i): NodeSpec => ({ id: `bug-flower-${i}`, x, z, biomes: ["flowers"], categories: ["bug"] })),
    ...ISLAND_TREES.slice(4, 9).map(([x, z], i): NodeSpec => ({ id: `bug-tree-${i}`, x, z: z - 0.6, biomes: ["trees"], categories: ["bug"] })),
    ...[[-6, -1.4], [6, -1.5], [12, 1.8], [-12, -1.6]].map(([x, z], i): NodeSpec => ({ id: `bug-water-${i}`, x, z, biomes: ["water_edge"], categories: ["bug"] })),
    ...[[-3, -13], [4, -12], [10, -13]].map(([x, z], i): NodeSpec => ({ id: `bug-ground-${i}`, x, z, biomes: ["ground"], categories: ["bug"] })),
  ];
  const onLand = (n: NodeSpec) => isGroundAtWorld(land, n.x, n.z);
  return { forage: [...fruit, ...shells, ...rocks, ...woods, ...flowers].filter(onLand), bugs: bugs.filter(onLand) };
}

export function homeNodes(): { forage: NodeSpec[]; bugs: NodeSpec[] } {
  const fruit = HOME_TREES.map(([x, z], i): NodeSpec => ({ id: `home-fruit-${i}`, x, z: z - 0.9, biomes: ["trees"], categories: ["fruit"], canopy: true }));
  const land = createHomeIsland().map;
  const shells = beachRing(HOME_RADII, 5, 0.9, 1.2).filter(([x, z]) => z < 6 && isGroundAtWorld(land, x, z)).map(([x, z], i): NodeSpec => ({ id: `home-shell-${i}`, x, z, biomes: ["beach"], categories: ["nature"] }));
  const bugs = HOME_FLOWERS.map(([x, z], i): NodeSpec => ({ id: `home-bug-${i}`, x, z, biomes: ["flowers"], categories: ["bug"] }));
  const onLand = (n: NodeSpec) => isGroundAtWorld(land, n.x, n.z);
  return { forage: [...fruit, ...shells].filter(onLand), bugs: bugs.filter(onLand) };
}
