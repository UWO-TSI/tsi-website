/**
 * Foraging and bug node placement for the village core and the home island,
 * derived from each island's own layout data (trees, rocks, flowers, beach
 * band, river banks) so nodes move with the layout. The village's comes from
 * its map file: trees, rocks and flowers carry their nodes, and the shells,
 * bug spots and bottle spots are objects placed in /lab/map.
 */
import type { NodeSpec } from "@/components/game/peaceful/VillageLife";
import { HOME_FLOWERS, HOME_RADII, HOME_TREES, HOME_TREE_SEEDS, createHomeIsland } from "./homeIsland";
import { isGroundAtWorld } from "./grid";
import { MATERIALS } from "@/lib/crafting/recipes";
import { objectsOf, village, type Village } from "./villageMap";
import { isCedar } from "./defaultIsland";
import type { TreeSpot } from "./treeFruit";

/**
 * Any tree can be shaken for a branch (crafting); a fruit tree gives its fruit first. A tree's nodes stand at its
 * trunk (the orbit camera lets you shake it from any side) and carry the tree, so its fruit hangs in its own crown
 * (lib/game/treeFruit.ts).
 */
const BRANCH = MATERIALS.find(m => m.key === "wood_branch")!;
const branchNodes = (trees: readonly TreeSpot[], prefix: string) =>
  trees.map((tree, i): NodeSpec => ({ id: `${prefix}branch-${i}`, x: tree.x, z: tree.z, biomes: ["trees"], categories: ["mineral"], canopy: true, drop: BRANCH, tree }));
const fruitNode = (id: string, tree: TreeSpot): NodeSpec => ({ id, x: tree.x, z: tree.z, biomes: ["trees"], categories: ["fruit"], canopy: true, tree });
const beachRing = (radii: { x: number; z: number }, count: number, r = 0.92, phase = 0.4): [number, number][] =>
  Array.from({ length: count }, (_, i) => { const a = phase + (i / count) * Math.PI * 2; return [Math.cos(a) * radii.x * r, Math.sin(a) * radii.z * r]; });
const xz = (o: { x: number; z: number }): [number, number] => [o.x, o.z];

export function villageNodes(v: Village = village()): { forage: NodeSpec[]; bugs: NodeSpec[] } {
  const trees = objectsOf("tree", v).map(({ x, z, seed = 0 }): TreeSpot => ({ x, z, seed })), flowers = objectsOf("flower", v).map(xz);
  // A cedar bears no fruit.
  const fruit = trees.filter(t => !isCedar(t.seed)).map((t, i) => fruitNode(`fruit-${i}`, t));
  const shells = objectsOf("shell", v).map(({ x, z }, i): NodeSpec => ({ id: `shell-${i}`, x, z, biomes: ["beach"], categories: ["nature", "fruit"] }));
  const rocks = objectsOf("rock", v).map((p, i): NodeSpec => ({ id: `rock-${i}`, x: p.x, z: p.z - 0.9, biomes: ["rocks"], categories: ["mineral"] }));
  const woods = trees.slice(0, 4).map(({ x, z }, i): NodeSpec => ({ id: `mush-${i}`, x: x + 0.9, z: z - 0.4, biomes: ["woods"], categories: ["nature"] }));
  const blooms = flowers.slice(0, 6).map(([x, z], i): NodeSpec => ({ id: `flower-${i}`, x: x + 0.7, z: z - 0.6, biomes: ["flowers"], categories: ["nature"] }));
  const spots = (biome: string) => objectsOf("bug", v).filter(b => b.model === biome);
  const bugs: NodeSpec[] = [
    ...flowers.slice(6, 12).map(([x, z], i): NodeSpec => ({ id: `bug-flower-${i}`, x, z, biomes: ["flowers"], categories: ["bug"] })),
    ...trees.slice(4, 9).map(({ x, z }, i): NodeSpec => ({ id: `bug-tree-${i}`, x, z: z - 0.6, biomes: ["trees"], categories: ["bug"] })),
    ...spots("water_edge").map(({ x, z }, i): NodeSpec => ({ id: `bug-water-${i}`, x, z, biomes: ["water_edge"], categories: ["bug"] })),
    ...spots("ground").map(({ x, z }, i): NodeSpec => ({ id: `bug-ground-${i}`, x, z, biomes: ["ground"], categories: ["bug"] })),
  ];
  const onLand = (n: NodeSpec) => isGroundAtWorld(v.map, n.x, n.z);
  return { forage: [...fruit, ...shells, ...rocks, ...woods, ...blooms, ...branchNodes(trees, "")].filter(onLand), bugs: bugs.filter(onLand) };
}

/** Where today's message bottle washes up (crafting): one of the map's bottle spots, by Toronto day. */
export function villageBottleSpot(day: string, v: Village = village()): [number, number] {
  const spots = objectsOf("bottle", v).map(xz).filter(([x, z]) => isGroundAtWorld(v.map, x, z));
  if (!spots.length) return [v.bounds.cx, v.bounds.cz];
  return spots[[...day].reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % spots.length];
}

export function homeNodes(): { forage: NodeSpec[]; bugs: NodeSpec[] } {
  const trees = HOME_TREES.map(([x, z], i): TreeSpot => ({ x, z, seed: HOME_TREE_SEEDS[i] }));
  // Ids by the island's tree, so a cedar's skipped slot never renames another tree's fruit.
  const fruit = trees.flatMap((t, i) => isCedar(t.seed) ? [] : [fruitNode(`home-fruit-${i}`, t)]);
  const land = createHomeIsland().map;
  const shells = beachRing(HOME_RADII, 5, 0.9, 1.2).filter(([x, z]) => z < 6 && isGroundAtWorld(land, x, z)).map(([x, z], i): NodeSpec => ({ id: `home-shell-${i}`, x, z, biomes: ["beach"], categories: ["nature"] }));
  const bugs = HOME_FLOWERS.map(([x, z], i): NodeSpec => ({ id: `home-bug-${i}`, x, z, biomes: ["flowers"], categories: ["bug"] }));
  const onLand = (n: NodeSpec) => isGroundAtWorld(land, n.x, n.z);
  return { forage: [...fruit, ...shells, ...branchNodes(trees, "home-")].filter(onLand), bugs: bugs.filter(onLand) };
}
