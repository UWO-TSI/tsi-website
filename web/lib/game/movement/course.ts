/**
 * The /lab/move test course (specs/movement.md, build order 2). A test course,
 * not island design: David paints the island himself (rows 241, 246).
 *
 * One lap around a pond, built on the grid with the ACNH rules (1.5u cliffs,
 * ramps, integer cells). The camera looks +z and +x is screen left, so the
 * sections that need to see ahead run up the screen or across it:
 *
 *   right lane, up      sprint lane (dirt track) and room to chain hops
 *   top stretch, left   rivers 2, 3 and 4 tiles wide, seen side on; 1-wide
 *                       causeways (the narrow bridge) across the 3 and 4
 *   left lane, down     obstacles: a building, fences with a gap, rocks,
 *                       trees, a bench
 *   bottom, right       a one-level cliff to mantle (or its ramp), a second
 *                       level on top (mantle or ramp), drops of 1.5 and 3.0,
 *                       a 5-wide pond with a 1-wide causeway
 *
 * A lap starts on the brick line in the right lane, passes the four
 * checkpoints in order and ends back on the line.
 */
import { CLIFF_LEVELS, Surface, createCenteredMap, setCell, worldToCellX, worldToCellZ, type IslandMap } from "../grid";
import { villageOf, type MapObject, type Village } from "../villageMap";

export const COURSE_SPAWN: [number, number] = [-17, -21];

/** Axis-aligned world rects (cell centres inclusive). */
type Rect = [x0: number, x1: number, z0: number, z1: number];
const inside = (x: number, z: number, [x0, x1, z0, z1]: Rect) => x >= x0 && x <= x1 && z >= z0 && z <= z1;

/** Start line, then the checkpoints in lap order. */
export const COURSE_GATES: { name: string; rect: Rect }[] = [
  { name: "Start", rect: [-20, -14, -16, -16] },
  { name: "Top of the sprint lane", rect: [-20, -14, 16, 17] },
  { name: "Past the rivers", rect: [12, 20, 18, 24] },
  { name: "Past the obstacles", rect: [14, 20, -18, -16] },
  { name: "Over the cliffs", rect: [-6, -2, -24, -18] },
];

/** Labels over each section, for the lab. */
export const COURSE_SIGNS: { text: string; x: number; z: number }[] = [
  { text: "Sprint lane · chain hops", x: -17, z: -8 },
  { text: "2 tiles", x: -9.5, z: 21 },
  { text: "3 tiles", x: -1, z: 21 },
  { text: "4 tiles", x: 9.5, z: 21 },
  { text: "Obstacles", x: 17, z: 12 },
  { text: "Mantle (or the ramp)", x: 13, z: -21 },
  { text: "Second level", x: 6, z: -21 },
  { text: "Drops", x: -1, z: -21 },
  { text: "Narrow bridge", x: -9, z: -21 },
];

/** The course terrain: land, water, the two plateaus and their ramps. */
export function courseMap(): IslandMap {
  const map = createCenteredMap(48, 56);
  const land = (x: number, z: number) =>
    x >= -20 && x <= 20 && z >= -24 && z <= 24 && !inside(x, z, [-13, 13, -17, 17]) // the ring around the pond
    && !inside(x, z, [-10, -9, 18, 23]) && !inside(x, z, [-2, 0, 18, 23]) && !inside(x, z, [8, 11, 18, 23]) // rivers, causeways on z 24
    && !(inside(x, z, [-11, -7, -24, -18]) && z !== -21); // the narrow-bridge pond
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    const x = cx + map.originX, z = cz + map.originZ;
    let level = 0, surface: number = land(x, z) ? Surface.Grass : Surface.River;
    if (surface === Surface.Grass) {
      if (inside(x, z, [-1, 13, -24, -18])) level = CLIFF_LEVELS; // first plateau
      if (inside(x, z, [0, 6, -23, -19])) level = 2 * CLIFF_LEVELS; // second level, inset a tile
      if (x === -17 && z >= -17 && z <= 17) surface = Surface.Soil; // the sprint track
      if (z === -16 && x >= -20 && x <= -14) surface = Surface.Brick; // start line
    }
    setCell(map, cx, cz, level, surface);
  }
  // Causeways (the narrow bridges) are paths.
  for (const x of [-10, -9, -2, -1, 0, 8, 9, 10, 11]) setCell(map, worldToCellX(map, x), worldToCellZ(map, 24), 0, Surface.Soil);
  for (const x of [-11, -10, -9, -8, -7]) setCell(map, worldToCellX(map, x), worldToCellZ(map, -21), 0, Surface.Soil);
  // Ramps (stored at the lower level, climbing toward -x): onto the first plateau at its near edge, onto the second in its middle.
  for (const [x, z, level] of [[12, -24, 0], [13, -24, 0], [12, -23, 0], [13, -23, 0], [7, -21, 2], [8, -21, 2], [7, -20, 2], [8, -20, 2]] as const)
    setCell(map, worldToCellX(map, x), worldToCellZ(map, z), level, Surface.Ramp);
  return map;
}

/** Obstacles in the left lane (and a spawn). */
export const COURSE_OBJECTS: MapObject[] = [
  { id: "default", kind: "spawn", x: COURSE_SPAWN[0], z: COURSE_SPAWN[1] },
  { id: "cafe", kind: "landmark", x: 17, z: 8 },
  ...[14, 15, 16, 18, 19, 20].map((x, i): MapObject => ({ id: `fence-${i}`, kind: "fence", x, z: 2.5, model: "fence-country-a" })),
  { id: "rock-1", kind: "rock", x: 15.5, z: -1.5, model: "rock-a" },
  { id: "rock-2", kind: "rock", x: 18.6, z: -4, model: "rock-b" },
  { id: "rock-3", kind: "rock", x: 16.2, z: -7, model: "rock-c" },
  { id: "tree-1", kind: "tree", x: 19, z: -10, seed: 0 },
  { id: "tree-2", kind: "tree", x: 15, z: -12, seed: 3 },
  { id: "bench-1", kind: "bench", x: 17.5, z: -14.5, model: "bench-wood" },
];

let built: Village | null = null;
/** The course as a village: its height field, objects and bounds, built once. */
export function course(): Village {
  return (built ??= villageOf(courseMap(), COURSE_OBJECTS));
}

/** Which gate (index into COURSE_GATES) a point is in, or -1. */
export function gateAt(x: number, z: number): number {
  const rx = Math.round(x), rz = Math.round(z);
  return COURSE_GATES.findIndex(g => inside(rx, rz, g.rect));
}

/** Lap timing: the start line starts a lap, the checkpoints must follow in order, the line again finishes it. */
export interface Lap { running: boolean; next: number; start: number; last: number | null; best: number | null; splits: number[] }
export const NEW_LAP: Lap = { running: false, next: 1, start: 0, last: null, best: null, splits: [] };
export function lapStep(lap: Lap, gate: number, now: number): Lap {
  if (gate < 0) return lap;
  if (gate === 0) {
    if (lap.running && lap.next === COURSE_GATES.length) {
      const time = now - lap.start;
      return { running: true, next: 1, start: now, last: time, best: lap.best === null ? time : Math.min(lap.best, time), splits: [] };
    }
    return lap.running && lap.next > 1 ? lap : { ...lap, running: true, next: 1, start: now, splits: [] };
  }
  if (lap.running && gate === lap.next) return { ...lap, next: lap.next + 1, splits: [...lap.splits, now - lap.start] };
  return lap;
}
