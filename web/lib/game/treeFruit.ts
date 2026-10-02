/**
 * Fruit on the trees (specs/polish/world-refinement.md §3): it hangs in the tree's own space, at the spots
 * art/trees/build_trees.py measured on each closed crown (ACNH's Plant01, Plant02 and PlantTop joints carried out to
 * the leaves, front, back and the ringed lobes, lib/game/treeHang.ts), turned and sized with the tree, swaying with its
 * canopy (the same wind as modelMaterials' tree sway) and dropping from where it hangs when the tree is shaken.
 * Pure: every reader writes into a caller-owned point.
 */
import { TREE_HANG } from "./treeHang";
import { treeParts } from "./natureParts";

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

/**
 * Fruit `i` of a tree in the world: its hang point in the tree's frame, pushed by the canopy's sway (`time`, `amp`:
 * TREE_WIND, the shader's own formula, so it moves with the leaves around it), then turned and sized with the tree.
 */
export function hangAt(t: FruitTree, i: number, time: number, amp: number, out: Point): Point {
  const [hx, hy, hz] = t.hang[i];
  const h = Math.min(1, Math.max(0, hy / 3)) ** 2;
  const phase = time * 1.7 + t.x * 0.37 + t.z * 0.23;
  const lx = hx + Math.sin(phase) * amp * h, lz = hz + Math.cos(phase * 0.8) * amp * 0.6 * h;
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  out.x = t.x + (lx * c + lz * s) * t.scale;
  out.y = t.y + hy * t.scale;
  out.z = t.z + (-lx * s + lz * c) * t.scale;
  return out;
}

/** Seconds a shaken fruit takes to fall, settle and go. */
export const DROP = { gravity: 9.8, bounce: 0.18, rest: 1.4, fade: 0.35 } as const;
export const DROP_TIME = 3;

/**
 * A shaken fruit `t` seconds after the shake, from `from` (where it hung) down to `ground` under it: it falls, hops
 * once on landing, rests, then shrinks away (returned scale 1 to 0; never a pop). `radius` is its half height.
 */
export function dropAt(from: Point, ground: number, radius: number, t: number, out: Point): number {
  out.x = from.x; out.z = from.z;
  const rest = ground + radius, height = Math.max(0, from.y - rest);
  const fall = Math.sqrt((2 * height) / DROP.gravity);
  if (t < fall) { out.y = from.y - 0.5 * DROP.gravity * t * t; return 1; }
  // One small hop: up with a fraction of the landing speed, back down.
  const v = DROP.gravity * fall * DROP.bounce, hop = (2 * v) / DROP.gravity, u = t - fall;
  out.y = rest + (u < hop ? v * u - 0.5 * DROP.gravity * u * u : 0);
  const gone = u - hop - DROP.rest;
  return gone <= 0 ? 1 : Math.max(0, 1 - gone / DROP.fade);
}
