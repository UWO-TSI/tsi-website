/**
 * Map health: every check the village map must pass, in one place
 * (specs/island-painter.md §9). `/lab/map` shows it live on every edit and
 * `villageMap.test.ts` asserts it on the shipped file, so "healthy" in the
 * panel means pasting the export keeps the suite green. Add a check here and
 * both follow.
 *
 * Terrain checks cost real debugging once each (an unreachable terrace, a
 * cliff with no piece, a one-cell wall, a face too tall for the kit). Village
 * checks are what the game's systems need from a painted island: every
 * landmark placed, on dry land, approachable and reachable from spawn;
 * resident anchors with room for three; every study table placed; enough
 * forage and bug spots; a fishable sea.
 */
import {
  CLIFF_LEVELS, DIR_OFFSETS, ORTHOGONAL, cliffPieceFor, inBounds, isGroundAtWorld, isLandCell, isRamp, isVoid, levelAt,
  needsCliff, rampDir, rampRun, surfaceAt, worldToCellX, worldToCellZ, type IslandMap,
} from "./grid";
import { LANDMARK_IDS, PROBE, TREE_TRUNK, bridgeDecks, inRect, islandOf, landmarks, objectFootprint, turn, wharfDeck } from "./defaultIsland";
import { CAST_REACH, WATER_CLASS, fishingSpot, villageWater } from "./fishingSpots";
import { villageNodes, villageBottleSpot } from "./islandNodes";
import { OBJECT_KINDS, objectsOf, villageSpawnPoint, type MapObject, type Village } from "./villageMap";
import { RESIDENT_ANCHORS, SHARED_SPACING, type ResidentAnchor } from "@/lib/content/residents";
import { FURNITURE, seatsOf, studySolid, type Furniture } from "@/lib/study/seats";
import { DEFAULT_TABLES } from "@/lib/study/tables";

export interface TerrainHealth {
  reachable: number;
  walkable: number;
  stranded: number;
  cliffCells: number;
  missingPiece: number;
  thinWalls: number;
  orphanRamps: number;
  tooTall: number;
  /** Land cells per level (water excluded). */
  levels: Record<number, number>;
  /** Land cells with an orthogonal neighbour exactly one level away: natural slope, blended by the height field. */
  slopeCells: number;
  /** Land cells whose eight neighbours all stand at their level: flat ground to build on, at any level. */
  flatCells: number;
  /** Reachable cells from the seed, as a mask (1 = reachable). */
  reach: Uint8Array;
}


/** Terrain checks on any map. `seed` is the cell reachability starts from (default: the first level-0 land cell). */
export function terrainHealth(map: IslandMap, seed?: [number, number] | null): TerrainHealth {
  const W = map.width, D = map.depth;
  let walkable = 0, cliffCells = 0, missingPiece = 0, thinWalls = 0, orphanRamps = 0, tooTall = 0, slopeCells = 0, flatCells = 0;
  const levels: Record<number, number> = {};
  let first: [number, number] | null = null;
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (!isLandCell(map, x, z)) continue;
      const l = levelAt(map, x, z);
      levels[l] = (levels[l] ?? 0) + 1;
      walkable++;
      if (!first && l === 0) first = [x, z];
      if (needsCliff(map, x, z)) {
        cliffCells++;
        if (!cliffPieceFor(map, x, z)) missingPiece++;
      }
      if (isRamp(surfaceAt(map, x, z)) && !rampDir(map, x, z)) orphanRamps++;
      let half = false;
      for (const [dx, dz] of ORTHOGONAL) {
        if (!inBounds(map, x + dx, z + dz)) continue;
        const ns = surfaceAt(map, x + dx, z + dz);
        const nl = isVoid(ns) ? 0 : levelAt(map, x + dx, z + dz);
        // The cliff kit is one piece tall and does not stack: a taller face renders as a hole.
        if (Math.abs(l - nl) > CLIFF_LEVELS) tooTall++;
        if (isLandCell(map, x + dx, z + dz) && Math.abs(l - nl) === 1) half = true;
      }
      if (half) slopeCells++;
      if (DIR_OFFSETS.every(([dx, dz]) => !isLandCell(map, x + dx, z + dz) || levelAt(map, x + dx, z + dz) === l)) flatCells++;
      // A cell a full cliff above the ground on both sides of an axis is a wall you cannot stand on.
      // (A one-cell half-step ridge is a walkable bump the blur rounds off.)
      const lower = (dx: number, dz: number) => isLandCell(map, x + dx, z + dz) && levelAt(map, x + dx, z + dz) <= l - CLIFF_LEVELS;
      if (l > 0 && ((lower(-1, 0) && lower(1, 0)) || (lower(0, -1) && lower(0, 1)))) thinWalls++;
    }
  }
  // Only a ramp whose RUN resolves is a route (a broken one renders flat and climbs nothing).
  const ramped = new Uint8Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (isRamp(surfaceAt(map, x, z)) && rampRun(map, x, z)) ramped[z * W + x] = 1;
  const reach = new Uint8Array(W * D);
  let reachable = 0;
  const start = seed && isLandCell(map, seed[0], seed[1]) ? seed : first;
  if (start) {
    const stack: [number, number][] = [start];
    while (stack.length) {
      const [x, z] = stack.pop()!;
      const i = z * W + x;
      if (reach[i] || !isLandCell(map, x, z)) continue;
      reach[i] = 1;
      reachable++;
      for (const [dx, dz] of ORTHOGONAL) {
        const nx = x + dx, nz = z + dz;
        if (!isLandCell(map, nx, nz)) continue;
        const d = Math.abs(levelAt(map, nx, nz) - levelAt(map, x, z));
        // A blended half step is walkable; a full cliff needs a working ramp.
        if (d < CLIFF_LEVELS || ramped[nz * W + nx] || ramped[i]) stack.push([nx, nz]);
      }
    }
  }
  return { reachable, walkable, stranded: walkable - reachable, cliffCells, missingPiece, thinWalls, orphanRamps, tooTall, levels, slopeCells, flatCells, reach };
}

/** Terrain problems as named counts; empty = healthy terrain. */
export function terrainProblems(t: TerrainHealth): Record<string, number> {
  const land = Math.max(1, t.walkable);
  const out: Record<string, number> = {
    "stranded cells": t.stranded, "cliffs with no kit piece": t.missingPiece, "orphan ramps": t.orphanRamps,
    "1-cell walls": t.thinWalls, "faces too tall": t.tooTall,
    // Flat share (CLAUDE.md 1b): mostly flat ground to build on, at any level. Hills and mountains are
    // slopes (one level between neighbours, walkable, any height up to MAX_LEVEL), so they cost flat
    // share and nothing else; cliffs keep their kit rules above.
    "flat ground under 60%": t.flatCells / land < 0.6 ? 1 : 0,
  };
  return Object.fromEntries(Object.entries(out).filter(([, n]) => n > 0));
}

export interface VillageHealth {
  terrain: TerrainHealth;
  /** Each failing check → what fails it (ids or counts). Empty = healthy. */
  problems: Record<string, string[]>;
  /** Overlapping footprints as "kind:id overlaps kind:id" (buildings keep a 1-tile gap): shown, not failing. */
  warnings: string[];
}


/** Axis-aligned footprint of an object (its objectFootprint turned by its yaw; a tree's trunk), for overlap warnings (null = a point). */
function footprintOf(o: MapObject): { x0: number; x1: number; z0: number; z1: number; building: boolean } | null {
  const f = o.kind === "tree" ? { hw: TREE_TRUNK, hd: TREE_TRUNK, cx: 0, cz: 0 } : objectFootprint(o);
  if (!f) return null;
  const yaw = o.yaw ?? 0, c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  const [ox, oz] = turn(f.cx, f.cz, yaw), x = o.x + ox, z = o.z + oz;
  const hx = f.hw * c + f.hd * s, hz = f.hw * s + f.hd * c;
  return { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, building: o.kind === "landmark" && f.hw > 1 };
}

/** Every check on a village (its map and objects). */
export function villageHealth(v: Village): VillageHealth {
  const { map } = v;
  const island = islandOf(v);
  const [sx, sz] = villageSpawnPoint(v);
  const terrain = terrainHealth(map, [worldToCellX(map, sx), worldToCellZ(map, sz)]);
  const problems: Record<string, string[]> = {};
  const add = (check: string, what: string) => (problems[check] ??= []).push(what);
  for (const [check, n] of Object.entries(terrainProblems(terrain))) add(check, String(n));
  const reached = (x: number, z: number) => {
    const cx = worldToCellX(map, x), cz = worldToCellZ(map, z);
    return inBounds(map, cx, cz) && terrain.reach[cz * map.width + cx] === 1;
  };
  const deck = wharfDeck(v);
  const onDeck = (x: number, z: number) => !!deck && inRect(x, z, deck);

  // Ids: unique within a kind (parseVillage drops unknown kinds).
  const seen = new Set<string>();
  for (const o of v.objects) {
    const key = `${o.kind}:${o.id}`;
    if (seen.has(key)) add("duplicate ids", key);
    seen.add(key);
  }

  if (!island.standable(sx, sz)) add("spawn not on open ground", `${sx},${sz}`);

  // Landmarks (row 155: every landmark exists from day one).
  const placed = landmarks(v);
  for (const id of LANDMARK_IDS) if (!placed.some(l => l.id === id)) add("landmarks missing", id);
  for (const l of placed) {
    if (l.id === "pond") { if (isGroundAtWorld(map, l.x, l.z)) add("pond not on water", l.id); continue; }
    if (l.id === "wharf") continue;
    const h = l.half ?? [0, 0];
    const dry = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].every(([a, b]) => isGroundAtWorld(map, l.x + a * h[0] * 0.95, l.z + b * h[1] * 0.95));
    if (!dry) add("landmarks not on dry land", l.id);
    if (!l.half) continue;
    const frontZ = l.z - h[1] - 0.6;
    const approach = [[l.x, frontZ], [l.x + 0.8, frontZ], [l.x - 0.8, frontZ]].find(([x, z]) => island.standable(x, z));
    if (!approach) add("landmarks with no approach", l.id);
    else if (!reached(approach[0], approach[1])) add("landmarks not reachable from spawn", l.id);
  }
  if (deck) {
    const mid: [number, number] = [(deck.x0 + deck.x1) / 2, (deck.z0 + deck.z1) / 2];
    if (!island.standable(...mid)) add("wharf deck not walkable", "wharf");
    if (![[deck.x0, deck.z0], [deck.x1, deck.z0], [deck.x0, deck.z1], [deck.x1, deck.z1]].some(([x, z]) => !isGroundAtWorld(map, x, z))) add("wharf not over water", "wharf");
  }
  // Bridges: walk the deck end to end.
  for (const [i, d] of bridgeDecks(v).entries()) {
    const alongX = d.x1 - d.x0 >= d.z1 - d.z0, cx = (d.x0 + d.x1) / 2, cz = (d.z0 + d.z1) / 2;
    const [a, b]: [number, number][] = alongX ? [[d.x0 - 0.8, cz], [d.x1 + 0.8, cz]] : [[cx, d.z0 - 0.8], [cx, d.z1 + 0.8]];
    const end = island.move(a[0], a[1], b[0], b[1]);
    if (!island.standable(...a) || Math.hypot(end[0] - b[0], end[1] - b[1]) > 0.2) add("bridges not crossable", objectsOf("bridge", v)[i].id);
  }

  // Everything that stands on the ground.
  const grounded = new Set<string>(OBJECT_KINDS.filter(k => k !== "landmark" && k !== "bridge"));
  // On the organic coast the game draws, not on the painted cell: a shell on a cell's sea corner is in the water.
  // An object standing on the lip (within a body's reach, PROBE) still counts as ashore.
  const ashore = (x: number, z: number) => PROBE.some(([dx, dz]) => isGroundAtWorld(map, x + dx, z + dz));
  for (const o of v.objects) if (grounded.has(o.kind) && !ashore(o.x, o.z) && !onDeck(o.x, o.z)) add("objects off land", `${o.kind}:${o.id}`);

  // Resident anchors: open ground for three residents side by side.
  for (const key of Object.keys(RESIDENT_ANCHORS) as ResidentAnchor[]) {
    const a = objectsOf("anchor", v).find(o => o.id === key);
    if (!a) { add("resident anchors missing", key); continue; }
    for (let k = 0; k < 3; k++) if (!PROBE.every(([dx, dz]) => island.standable(a.x + k * SHARED_SPACING + dx, a.z + dz))) { add("resident anchors without room for 3", key); break; }
  }
  if (!objectsOf("gather", v).length) add("no ceremony gather spots", "gather");

  // Study tables: every backend outdoor table placed, with its seat count, seats clear and apart.
  const village = DEFAULT_TABLES.filter(t => t.location !== "cafe");
  for (const t of village) {
    const o = objectsOf("study", v).find(s => s.id === t.anchor);
    if (!o) { add("study tables missing", t.anchor); continue; }
    if (!o.model || !(o.model in FURNITURE) || FURNITURE[o.model as Furniture].seats.length !== t.seats) add("study tables with the wrong furniture", t.anchor);
  }
  const seats = objectsOf("study", v).flatMap(o => seatsOf(o.id, undefined, v));
  for (const s of seats) if (studySolid("village", s.x, s.z, 0.2, v)) add("study seats blocked", `${s.anchor}#${s.seat}`);
  for (const a of seats) for (const b of seats) if (a !== b && a.anchor < b.anchor && Math.hypot(a.x - b.x, a.z - b.z) <= 0.8) add("study seats too close", `${a.anchor}#${a.seat}`);

  // Forage and bugs (peaceful loop): enough of each to play.
  const { forage, bugs } = villageNodes(v);
  const count = (pred: (n: (typeof forage)[number]) => boolean) => forage.filter(pred).length;
  if (!count(n => n.categories.includes("fruit") && n.biomes.includes("trees"))) add("forage", "no fruit trees");
  if (!count(n => n.biomes.includes("beach"))) add("forage", "no beach shells");
  if (!count(n => n.categories.includes("mineral"))) add("forage", "no rocks or branches");
  if (count(n => n.drop?.key === "wood_branch") <= 4) add("forage", "5+ trees needed for branches");
  if (bugs.length < 12) add("forage", `12+ bug spots needed (${bugs.length})`);
  const bottles = new Set(["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"].map(d => String(villageBottleSpot(d, v))));
  if (objectsOf("bottle", v).filter(o => isGroundAtWorld(map, o.x, o.z)).length < 2 || bottles.size < 2) add("forage", "2+ bottle spots needed on the beach");

  // Fishing: the sea is fishable from the shore, and every water body there is, classified as the game does (pond markers included).
  const { classes, classify } = villageWater(v);
  const present = new Set<number>(classes);
  const fished = new Set<string>();
  let spots = 0;
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    if (classes[cz * map.width + cx] !== WATER_CLASS.land) continue;
    const x = map.originX + cx, z = map.originZ + cz;
    if (!island.standable(x, z) || !reached(x, z)) continue;
    const s = fishingSpot(map, classify, x, z);
    if (s) { spots++; fished.add(s.water); }
  }
  if (!present.has(WATER_CLASS.sea) || !fished.has("sea")) add("fishing", "no sea to fish from the shore");
  if (present.has(WATER_CLASS.river) && !fished.has("river")) add("fishing", "river not fishable");
  if (present.has(WATER_CLASS.pond) && !fished.has("pond")) add("fishing", "pond not fishable");
  if (spots < 60) add("fishing", `60+ shore spots needed (${spots}, reach ${CAST_REACH})`);

  // Overlaps and bridges on land: warnings only.
  const warnings: string[] = [];
  // A bridge stands over water: its middle on a river or the sea, not on painted ground.
  for (const [i, d] of bridgeDecks(v).entries()) {
    if (isGroundAtWorld(map, (d.x0 + d.x1) / 2, (d.z0 + d.z1) / 2)) warnings.push(`bridge:${objectsOf("bridge", v)[i].id} is not over water: paint River under it`);
  }
  const boxes = v.objects.flatMap(o => { const f = footprintOf(o); return f ? [{ o, f }] : []; });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j], gap = a.f.building && b.f.building ? 1 : 0;
    if (a.f.x0 < b.f.x1 + gap && b.f.x0 < a.f.x1 + gap && a.f.z0 < b.f.z1 + gap && b.f.z0 < a.f.z1 + gap) warnings.push(`${a.o.kind}:${a.o.id} overlaps ${b.o.kind}:${b.o.id}${gap ? " (buildings keep a 1-tile gap)" : ""}`);
  }
  return { terrain, problems, warnings };
}
