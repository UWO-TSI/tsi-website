/**
 * The village map file (specs/island-painter.md, rows 241, 246).
 *
 * `web/data/village-map.json` is the member island: the terrain grid in the
 * `island-map.json` document format plus an object layer. `/lab/map` paints it
 * and the game loads exactly what is painted. Every building, tree, prop, table,
 * resident anchor, spawn, puddle and bug spot is an object here, in world
 * coordinates; what an object IS (its model, footprint, door) stays in code,
 * keyed by its kind and id.
 *
 * ONE SEA CONVENTION. The sea is River water at level 0, the same cells the
 * terrain, ocean, glints and fishing already treat as water. Legacy drafts
 * painted the sea as Void (no ground at all), which the member island would draw
 * as a hole, so parsing turns Void into sea. Sea, river and pond are told apart
 * by water connectivity (`classifyWater` in fishingSpots.ts), never by a shape.
 *
 * Built once per document: the grid, its height field and its bounds are cached
 * here and shared by every caller (`village()`), so the island is not rebuilt per
 * component. `/lab/island?draft=1` swaps the document with `setVillageDoc`
 * before the world mounts.
 */
import villageDoc from "@/data/village-map.json";
import {
  heightField, isVoid, isWater, parseIslandMap, serialiseIslandMap, surfaceAt, Surface,
  type IslandMap, type IslandMapDoc, type MapAnnotation, type PlacedProp,
} from "./grid";

/** Object vocabulary. Append only: kinds are persisted in the map file. */
export const OBJECT_KINDS = [
  "spawn", "landmark", "fitting", "missions", "bridge", "lamp", "fence", "bench", "rock",
  "tree", "bush", "flower", "study", "anchor", "gather", "puddle", "bug", "shell", "bottle",
] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

/**
 * One placed thing. `id` is stable and unique within its kind (saved resident
 * schedules and study tables reference anchor and table ids). `x`/`z` are world
 * coordinates; `yaw` radians about +y; `seed` picks a nature variant; `model`
 * names the variant where a kind has several (rock model, study furniture, bug
 * biome, fence variant).
 */
export interface MapObject {
  id: string;
  kind: ObjectKind;
  x: number;
  z: number;
  yaw?: number;
  scale?: number;
  seed?: number;
  model?: string;
}

/** The on-disk shape: the terrain document plus the object layer. */
export interface VillageDoc extends IslandMapDoc {
  objects?: { id: string; kind: string; x: number; z: number; yaw?: number; scale?: number; seed?: number; model?: string }[];
}

const KINDS = new Set<string>(OBJECT_KINDS);

/** Turn painted Void into sea: River at level 0 (the one sea convention). Returns cells changed. */
export function normaliseSea(map: IslandMap): number {
  let changed = 0;
  for (let i = 0; i < map.surfaces.length; i++) {
    if (!isVoid(map.surfaces[i])) continue;
    map.surfaces[i] = Surface.River;
    map.levels[i] = 0;
    changed++;
  }
  return changed;
}

/** Parse a map document. `props` are legacy planning markers (island-map.json), carried for the painter only. */
export function parseVillage(doc: VillageDoc): { map: IslandMap; objects: MapObject[]; annotations: MapAnnotation[]; props: PlacedProp[] } {
  const { map, annotations, props } = parseIslandMap(doc);
  normaliseSea(map);
  const objects: MapObject[] = [];
  for (const o of doc.objects ?? []) {
    if (!o || !KINDS.has(o.kind) || typeof o.id !== "string" || !Number.isFinite(o.x) || !Number.isFinite(o.z)) continue;
    objects.push({
      id: o.id, kind: o.kind as ObjectKind, x: o.x, z: o.z,
      ...(Number.isFinite(o.yaw) && o.yaw ? { yaw: o.yaw } : {}),
      ...(Number.isFinite(o.scale) && o.scale !== 1 ? { scale: o.scale } : {}),
      ...(Number.isFinite(o.seed) ? { seed: o.seed } : {}),
      ...(typeof o.model === "string" ? { model: o.model } : {}),
    });
  }
  return { map, objects, annotations, props };
}

/** The whole document, as the painter exports it. Legacy cell markers are not carried. */
export function serialiseVillage(map: IslandMap, objects: readonly MapObject[], annotations: MapAnnotation[] = []): VillageDoc {
  const { props: _markers, ...terrain } = serialiseIslandMap(map, [], annotations);
  void _markers;
  return { ...terrain, objects: objects.map(o => ({ ...o })) };
}

/**
 * Pretty JSON for the repo: one grid row and one object per line, so a painted
 * change is a readable diff.
 */
export function villageJson(doc: VillageDoc): string {
  const rows = (a: readonly unknown[]) => `[\n${a.map(r => `    ${JSON.stringify(r)}`).join(",\n")}\n  ]`;
  const head = (["width", "depth", "originX", "originZ", "tile", "levelStep"] as const).map(k => `  "${k}": ${JSON.stringify(doc[k])}`);
  const tail = [`  "levels": ${rows(doc.levels)}`, `  "surfaces": ${rows(doc.surfaces)}`];
  if (doc.annotations?.length) tail.push(`  "annotations": ${rows(doc.annotations)}`);
  tail.push(`  "objects": ${rows(doc.objects ?? [])}`);
  return `{\n${[...head, ...tail].join(",\n")}\n}\n`;
}

/** Land extent in world units (cell edges): what size-dependent systems scale with. */
export interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number; cx: number; cz: number; halfW: number; halfD: number }

export function landBounds(map: IslandMap): Bounds {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    const s = surfaceAt(map, cx, cz);
    if (isWater(s)) continue;
    if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cz < z0) z0 = cz; if (cz > z1) z1 = cz;
  }
  if (x0 > x1) { x0 = 0; x1 = map.width - 1; z0 = 0; z1 = map.depth - 1; }
  const minX = map.originX + x0 - 0.5, maxX = map.originX + x1 + 0.5, minZ = map.originZ + z0 - 0.5, maxZ = map.originZ + z1 + 0.5;
  return { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, halfW: (maxX - minX) / 2, halfD: (maxZ - minZ) / 2 };
}

export interface Village {
  map: IslandMap;
  /** The terrain's corner height field, built once (GridTerrain, walking and placement share it). */
  field: Float32Array;
  objects: readonly MapObject[];
  bounds: Bounds;
}

export function buildVillage(doc: VillageDoc): Village {
  const { map, objects } = parseVillage(doc);
  return villageOf(map, objects);
}

/** A village from a map already in memory (the painter's draft). */
export function villageOf(map: IslandMap, objects: readonly MapObject[]): Village {
  return { map, field: heightField(map), objects, bounds: landBounds(map) };
}

/** Where /lab/map autosaves its working draft, and where `/lab/island?draft=1` reads it. */
export const PAINTER_DRAFT_KEY = "lab-map-village-draft-v1";

let source: VillageDoc = villageDoc as VillageDoc;
let current: Village | null = null;

/** The member island every system reads: the shipped file, or a lab draft. */
export function village(): Village {
  return (current ??= buildVillage(source));
}

/** Replace the document (lab drafts). Call before the world mounts. */
export function setVillageDoc(doc: VillageDoc): void {
  source = doc;
  current = null;
}

/** Objects of one kind, in file order. */
export function objectsOf(kind: ObjectKind, v: Village = village()): MapObject[] {
  return v.objects.filter(o => o.kind === kind);
}

export function objectById(kind: ObjectKind, id: string, v: Village = village()): MapObject | null {
  return v.objects.find(o => o.kind === kind && o.id === id) ?? null;
}

/** Where a fresh visit starts: the `default` spawn (else any spawn, else the land's centre). */
export function villageSpawnPoint(v: Village = village()): [number, number] {
  const spawns = objectsOf("spawn", v), s = spawns.find(o => o.id === "default") ?? spawns[0];
  return s ? [s.x, s.z] : [v.bounds.cx, v.bounds.cz];
}
