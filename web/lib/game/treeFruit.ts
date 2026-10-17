/**
 * Fruit on the trees (specs/polish/world-refinement.md §3): it hangs in the tree's own space, at the spots
 * art/trees/build_trees.py measured on each closed crown (ACNH's Plant01, Plant02 and PlantTop joints carried out to
 * the leaves, front, back and the ringed lobes, lib/game/treeHang.ts), turned and sized with the tree, swaying with its
 * canopy (the same wind as modelMaterials' tree sway) and dropping from where it hangs when the tree is shaken.
 * Pure: every reader writes into a caller-owned point.
 */
import { TREE_HANG } from "./treeHang";
import { treeParts } from "./natureParts";
import { WORLD_SHAKES, type Shakes } from "./treeShake";

/** ACNH's own fruit (the dump's UnitIconPltFruit models, extracted like the rest of the kit). */
export const FRUIT_MODEL: Readonly<Record<string, string>> = {
  apple: "/assets/acnh/fruit/apple.glb",
  peach: "/assets/acnh/fruit/peach.glb",
  fruit_pear: "/assets/acnh/fruit/pear.glb",
  fruit_orange: "/assets/acnh/fruit/orange.glb",
  fruit_cherry: "/assets/acnh/fruit/cherry.glb",
  fruit_coconut: "/assets/acnh/fruit/coconut.glb",
};
/** The models are icon-sized (about 0.45 tall); on a tree a fruit is about 0.32, as big as it reads in ACNH. */
export const FRUIT_SCALE = 0.72;

export interface TreeSpot { x: number; z: number; seed: number }
export interface Point { x: number; y: number; z: number }
/** A tree as drawn: where it stands, its turn and size (treeParts), and where its fruit hangs in its own frame. */
export interface FruitTree { x: number; y: number; z: number; yaw: number; scale: number; hang: readonly (readonly [number, number, number])[] }

/** The tree a spot draws this season and its hang points; none for a crown without them (a cedar bears no fruit). */
export function fruitTree(spot: TreeSpot, y: number, models?: readonly string[]): FruitTree | null {
  const [part] = treeParts(spot.seed, models);
  const hang = TREE_HANG[part.url.replace(/^.*\/|\.glb$/g, "")];
  return hang ? { x: spot.x, y, z: spot.z, yaw: part.yaw, scale: part.scale, hang } : null;
}

const _shake = { x: 0, z: 0 };
/**
 * Fruit `i` of a tree in the world: its hang point in the tree's frame, pushed by the canopy's sway (`time`, `amp`:
 * TREE_WIND, the shader's own formula, so it moves with the leaves around it) and by a shake of that tree (`shakes`,
 * lib/game/treeShake.ts: the shader's own wobble), then turned and sized with the tree.
 */
export function hangAt(t: FruitTree, i: number, time: number, amp: number, out: Point, shakes: Shakes = WORLD_SHAKES): Point {
  const hang = t.hang[i], hx = hang[0], hy = hang[1], hz = hang[2];
  const h = Math.min(1, Math.max(0, hy / 3)) ** 2;
  const phase = time * 1.7 + t.x * 0.37 + t.z * 0.23;
  shakes.at(t.x, t.z, time, _shake);
  const lx = hx + (Math.sin(phase) * amp + _shake.x) * h, lz = hz + (Math.cos(phase * 0.8) * amp * 0.6 + _shake.z) * h;
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  out.x = t.x + (lx * c + lz * s) * t.scale;
  out.y = t.y + hy * t.scale;
  out.z = t.z + (-lx * s + lz * c) * t.scale;
  return out;
}

/**
 * The hang point a shake lets go of: the one hanging nearest the shaker, so it falls on their side of the tree.
 * `time` the world second (the canopy where it is now, still air).
 */
export function nearestHang(t: FruitTree, x: number, z: number, time: number, skip = -1): number {
  let best = -1, bestD = Infinity;
  for (let k = 0; k < t.hang.length; k++) {
    if (k === skip) continue;
    hangAt(t, k, time, 0, _near);
    const d = Math.hypot(_near.x - x, _near.z - z) + Math.max(0, _near.y - t.y - 2.2 * t.scale) * 0.3;
    if (d < bestD) { bestD = d; best = k; }
  }
  return best;
}
const _near: Point = { x: 0, y: 0, z: 0 };
