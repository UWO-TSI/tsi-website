/**
 * The natural barriers (specs/v1-drop.md §2): what keeps a zone closed until its drop opens it, with no invisible wall
 * and no sign. Each is a matte prop (art/barriers/build_barriers.py) that blocks like a building while its drop is not
 * out (lib/game/drops.ts), and is gone, prop and solid, once it is:
 *
 * | Model | Where | Gone with |
 * |---|---|---|
 * | unbuilt-bridge | the north island's bridge head: stacked planks, survey stakes, a rope across | `northIsland` (no drop yet) |
 * | forest-edge | the dense edge of the forest round the ruins, in segments | `forest` (v3) |
 * | ruins-rubble | fallen stones and roots across the ruins entrance | `ruins` (v3) |
 * | rockslide | boulders over the mountain trail | `mountain` (v2) |
 *
 * Placements are map objects of kind "barrier" (`model` names which), placed by David in /lab/map from the proposal
 * (web/data/proposals/v1-barriers.json). The village's ruins gate is the one barrier the map doesn't place: until the
 * ruins open, the gate landmark is drawn as rubble (`GATE_RUBBLE`). Pure: the walker (defaultIsland islandOf), the
 * scenery (NatureModels sceneryOf), the painter and the tests share it.
 */
import { DROPS, type DropFeature, type DropFlags } from "./drops";
import type { MapObject, Village } from "./villageMap";

/** The barrier props (each a model). */
export const BARRIER_MODELS = ["unbuilt-bridge", "forest-edge", "ruins-rubble", "rockslide"] as const;
/**
 * Plus "border": the new world's invisible wall round the meadow (David, terrain v3 R1 notes 2026-10-24: "invisible
 * boarders for now that says release soon", overriding the no-invisible-wall rule there), in segments
 * (lib/game/world/generate.ts BORDER); walking up to it says BORDER_NOTE (components/game/BorderNotice.tsx).
 */
export type BarrierModel = (typeof BARRIER_MODELS)[number] | "border";
export const BORDER_NOTE = "This area is releasing soon.";

/** A solid rectangle in the model's own frame (before its yaw and scale): centre x, z and half extents. */
export type BarrierSolid = readonly [cx: number, cz: number, hw: number, hd: number];
export interface BarrierDef {
  label: string;
  /** Its model; null draws nothing (the border). */
  url: string | null;
  /** The drop feature that clears it. */
  feature: DropFeature;
  /** What blocks, covering the model's footprint on the ground (art/barriers/build_barriers.py). */
  solids: readonly BarrierSolid[];
}

const url = (m: BarrierModel) => `/assets/game/props/${m}.glb`;
export const BARRIERS: Record<BarrierModel, BarrierDef> = {
  "unbuilt-bridge": { label: "Unbuilt bridge", url: url("unbuilt-bridge"), feature: "northIsland", solids: [[0.38, 0.12, 1.62, 0.93]] },
  "forest-edge": { label: "Dense forest edge", url: url("forest-edge"), feature: "forest", solids: [[-0.08, 0.14, 2.62, 1.12]] },
  "ruins-rubble": { label: "Ruins rubble", url: url("ruins-rubble"), feature: "ruins", solids: [[0.09, -0.05, 1.8, 1.19]] },
  "rockslide": { label: "Rockslide", url: url("rockslide"), feature: "mountain", solids: [[-0.03, 0.18, 2.2, 1.75]] },
  // 8 u a segment at scale 1, overlapping its neighbours a little at the bends.
  "border": { label: "Border (opens soon)", url: null, feature: "meadow", solids: [[0, 0, 4.4, 1]] },
};
export const isBarrierModel = (m: string | undefined): m is BarrierModel => !!m && m in BARRIERS;

export interface BarrierPlacement { id: string; model: BarrierModel; x: number; z: number; yaw: number; scale: number }

/** The ruins gate's rubble: the gate (a 0.8 × 3.2 landmark across the way) turned a quarter, its front to the village. */
export const GATE_RUBBLE = { model: "ruins-rubble" as const, turn: Math.PI / 2 };

/** The barriers standing on this map at this drop: the map's barrier objects whose drop isn't out, and the gate rubble. */
export function barrierPlacements(v: Pick<Village, "objects">, flags: DropFlags = DROPS): BarrierPlacement[] {
  const placed = v.objects.filter(o => o.kind === "barrier").flatMap((o: MapObject): BarrierPlacement[] =>
    isBarrierModel(o.model) && !flags[BARRIERS[o.model].feature] ? [{ id: o.id, model: o.model, x: o.x, z: o.z, yaw: o.yaw ?? 0, scale: o.scale ?? 1 }] : []);
  const gates = flags.ruins ? [] : v.objects.filter(l => l.kind === "landmark" && l.id === "ruins")
    .map((l): BarrierPlacement => ({ id: "ruins-gate", model: GATE_RUBBLE.model, x: l.x, z: l.z, yaw: (l.yaw ?? 0) + GATE_RUBBLE.turn, scale: l.scale ?? 1 }));
  return [...placed, ...gates];
}

/** A placement's solids as world-frame tests: centre, yaw and half extents, plus a reach for a quick reject. */
export interface BarrierBox { x: number; z: number; yaw: number; hw: number; hd: number; reach: number }
export function barrierBoxes(placements: readonly BarrierPlacement[]): BarrierBox[] {
  return placements.flatMap(p => BARRIERS[p.model].solids.map(([cx, cz, hw, hd]): BarrierBox => {
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw), lx = cx * p.scale, lz = cz * p.scale;
    return { x: p.x + lx * c + lz * s, z: p.z - lx * s + lz * c, yaw: p.yaw, hw: hw * p.scale, hd: hd * p.scale, reach: Math.hypot(hw, hd) * p.scale };
  }));
}

/** Is (x, z) inside any barrier, or within `pad` of one? (The same turned-rectangle test as a prop's footprint, defaultIsland inFootprint.) */
export function inBarrier(boxes: readonly BarrierBox[], x: number, z: number, pad = 0): boolean {
  for (const b of boxes) {
    const dx = x - b.x, dz = z - b.z;
    if (Math.abs(dx) > b.reach + pad || Math.abs(dz) > b.reach + pad) continue;
    if (Math.abs(dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw)) < b.hw + pad && Math.abs(dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw)) < b.hd + pad) return true;
  }
  return false;
}

/** A barrier's footprint for the painter and the health check: the bound of its solids, in its own frame. */
export function barrierFootprint(model: string | undefined, scale = 1): { hw: number; hd: number; cx: number; cz: number } | null {
  if (!isBarrierModel(model)) return null;
  const s = BARRIERS[model].solids;
  const x0 = Math.min(...s.map(([cx, , hw]) => cx - hw)), x1 = Math.max(...s.map(([cx, , hw]) => cx + hw));
  const z0 = Math.min(...s.map(([, cz, , hd]) => cz - hd)), z1 = Math.max(...s.map(([, cz, , hd]) => cz + hd));
  return { hw: (x1 - x0) / 2 * scale, hd: (z1 - z0) / 2 * scale, cx: (x0 + x1) / 2 * scale, cz: (z0 + z1) / 2 * scale };
}
