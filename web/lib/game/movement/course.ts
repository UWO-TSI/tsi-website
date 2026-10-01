/**
 * The /lab/move test course (specs/movement.md, build order 2). A test course,
 * not island design: David paints the island himself (rows 241, 246).
 *
 * One lap around a pond, built on the grid with the ACNH rules (1.5u cliffs,
 * ramps, integer cells). The camera looks +z and +x is screen left, so the
 * sections that need to see ahead run up the screen or across it:
 *
 *   right lane, up      sprint lane (dirt track, a sand strip beside it) and room to bunny-hop
 *   top stretch, left   rivers 2, 3 and 4 tiles wide, seen side on; 1-wide
 *                       causeways (the narrow bridge) across the 3 and 4
 *   left lane, down     obstacles: a building, fences with a gap, rocks,
 *                       trees, a bench
 *   bottom, right       a one-level cliff to mantle (or its ramp), a second
 *                       level on top (mantle or ramp), drops of 1.5 and 3.0,
 *                       a 5-wide pond with a 1-wide causeway
 *   north of the top    the glide lane (specs/glider.md): a one-level tower
 *   right corner, up    (ramp on its east side), then a 3-tile river, a
 *                       2-tile island and a 5-tile sea gap to a beach, 10
 *                       tiles from the tower's edge; a causeway down the
 *                       right side walks back
 *   north of the top    the slide lane (specs/movement-slide.md), on a
 *   left corner, up     one-level shelf reached by a ramp: the dash-slide
 *                       straight to a 7-tile water gap only a slide-jump
 *                       clears;
 *                       a two-level tower whose ramp slides you off a lip
 *                       (the ramp launch); a run-up to a four-cell long
 *                       ramp and a terrain slope of two banks; one low
 *                       field round them all
 *
 * A lap starts on the brick line in the right lane, passes the four
 * checkpoints in order and ends back on the line.
 */
import { CLIFF_LEVELS, Surface, createMap, setCell, worldToCellX, worldToCellZ, type IslandMap } from "../grid";
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
  { text: "Sprint lane · hold Space to bunny-hop", x: -17, z: -8 },
  { text: "2 tiles", x: -9.5, z: 21 },
  { text: "3 tiles", x: -1, z: 21 },
  { text: "4 tiles", x: 9.5, z: 21 },
  { text: "Obstacles", x: 17, z: 12 },
  { text: "Mantle (or the ramp)", x: 13, z: -21 },
  { text: "Second level", x: 6, z: -21 },
  { text: "Drops", x: -1, z: -21 },
  { text: "Narrow bridge", x: -9, z: -21 },
  { text: "Glide lane · jump off, press Space again, hold", x: -17, z: 27 },
  { text: "River 3", x: -17, z: 30 },
  { text: "Sea gap 5", x: -17, z: 35.5 },
  { text: "Slide lane · hold Ctrl (C) at speed to slide", x: 17.5, z: 24.6 },
  { text: "Dash-slide straight · Q, then hold the slide", x: 17, z: 33 },
  { text: "Gap 7 · only a slide-jump clears it", x: 17, z: 48 },
  { text: "Ramp launch · up the tower, dash, slide off the lip", x: 10, z: 34 },
  { text: "Long ramp", x: 3, z: 38.5 },
  { text: "Terrain slope", x: -3.5, z: 38.5 },
];
/** The glide lane: the tower's top (one level), its north edge, and the beach 10 tiles on. */
export const GLIDE_TOWER: Rect = [-20, -16, 25, 28];
export const GLIDE_SPAWN: [number, number] = [-18, 26];
/** The slide lane: the shelf's runway (one level), the gap across it, the launch tower and lip, the long ramp, the banks. */
export const SLIDE_SPAWN: [number, number] = [17.5, 25.5];
export const SLIDE_GAP: Rect = [15, 19, 45, 51];
export const SLIDE_TOWER: Rect = [9, 11, 30, 36];
export const SLIDE_LIP: Rect = [8, 12, 39, 40];

/** The course terrain: land, water, the two plateaus and their ramps. */
export function courseMap(): IslandMap {
  const map = createMap(48, 96, -24, -28); // the lap's 48 x 56 (centred), the glide lane and the slide lane north of it
  const land = (x: number, z: number) =>
    (x >= -20 && x <= 20 && z >= -24 && z <= 24 && !inside(x, z, [-13, 13, -17, 17]) // the ring around the pond
    && !inside(x, z, [-10, -9, 18, 23]) && !inside(x, z, [-2, 0, 18, 23]) && !inside(x, z, [8, 11, 18, 23]) // rivers, causeways on z 24
    && !(inside(x, z, [-11, -7, -24, -18]) && z !== -21)) // the narrow-bridge pond
    || inside(x, z, [-20, -12, 25, 28]) || inside(x, z, [-20, -14, 32, 33]) || inside(x, z, [-20, -14, 39, 44]) // the glide lane: tower base, island, beach
    || inside(x, z, [-21, -21, 24, 44]) // its causeway
    || (inside(x, z, [-8, 20, 25, 62]) && !inside(x, z, SLIDE_GAP)); // the slide lane's apron, shelf and field, and its water gap
  for (let cz = 0; cz < map.depth; cz++) for (let cx = 0; cx < map.width; cx++) {
    const x = cx + map.originX, z = cz + map.originZ;
    let level = 0, surface: number = land(x, z) ? Surface.Grass : Surface.River;
    if (surface === Surface.Grass) {
      if (inside(x, z, [-1, 13, -24, -18])) level = CLIFF_LEVELS; // first plateau
      if (inside(x, z, [0, 6, -23, -19])) level = 2 * CLIFF_LEVELS; // second level, inset a tile
      if (x === -17 && z >= -17 && z <= 17) surface = Surface.Soil; // the sprint track
      if ((x === -19 || x === -18) && z >= -10 && z <= 10) surface = Surface.Sand; // a sand strip beside it (footsteps on sand)
      if (z === -16 && x >= -20 && x <= -14) surface = Surface.Brick; // start line
      if (inside(x, z, GLIDE_TOWER)) level = CLIFF_LEVELS; // the glide tower
      if (x === -21) surface = Surface.Soil;
      // The slide lane: a one-level shelf along its south side with a run-up block on the west, the runway north to
      // the gap and a landing past it, the launch block round a two-level tower (inset a tile) and its lip, the two
      // banks of the terrain slope (one level, then none).
      if (inside(x, z, [-8, 19, 27, 30]) || inside(x, z, [-8, 7, 31, 36]) || inside(x, z, [15, 19, 31, 44]) || inside(x, z, [15, 19, 52, 55]) || inside(x, z, [8, 12, 31, 40])) level = CLIFF_LEVELS;
      if (inside(x, z, SLIDE_TOWER)) level = 2 * CLIFF_LEVELS;
      if (inside(x, z, [-6, -1, 37, 39])) level = 1;
      if ((x === 17 && z >= 27 && z <= 44) || (x === 10 && z >= 30 && z <= 36) || ((x === 3 || x === -3) && z >= 31 && z <= 36)) surface = Surface.Soil; // the run-up tracks
      if (z === 44 && x >= 15 && x <= 19) surface = Surface.Brick; // the lip of the gap
      if (inside(x, z, [8, 12, 41, 55]) && (z - 41) % 2 === 1) surface = Surface.Sand; // the launch field, a stripe every 2 tiles
      if (inside(x, z, [-8, 20, 59, 62])) surface = Surface.Sand; // a sandy end to slide out on
    }
    setCell(map, cx, cz, level, surface);
  }
  // Causeways (the narrow bridges) are paths.
  for (const x of [-10, -9, -2, -1, 0, 8, 9, 10, 11]) setCell(map, worldToCellX(map, x), worldToCellZ(map, 24), 0, Surface.Soil);
  for (const x of [-11, -10, -9, -8, -7]) setCell(map, worldToCellX(map, x), worldToCellZ(map, -21), 0, Surface.Soil);
  // Ramps (stored at the lower level, climbing toward -x): onto the first plateau at its near edge, onto the second in its middle.
  for (const [x, z, level] of [[12, -24, 0], [13, -24, 0], [12, -23, 0], [13, -23, 0], [7, -21, 2], [8, -21, 2], [7, -20, 2], [8, -20, 2], [-15, 25, 0], [-14, 25, 0], [-15, 26, 0], [-14, 26, 0]] as const)
    setCell(map, worldToCellX(map, x), worldToCellZ(map, z), level, Surface.Ramp);
  // The slide lane's ramps: up onto the shelf (four wide), up onto the launch tower, the launch ramp off the tower to
  // its lip, the long ramp (four cells) down to the field, and down off the gap's landing.
  const ramp = (x0: number, x1: number, z0: number, z1: number, level: number) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) setCell(map, worldToCellX(map, x), worldToCellZ(map, z), level, Surface.Ramp);
  };
  ramp(16, 19, 25, 26, 0);
  ramp(9, 11, 28, 29, CLIFF_LEVELS);
  ramp(9, 11, 37, 38, CLIFF_LEVELS);
  ramp(1, 5, 37, 40, 0);
  ramp(15, 19, 56, 57, 0);
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
export interface Lap { running: boolean; next: number; start: number; last: number | null; best: number | null }
export const NEW_LAP: Lap = { running: false, next: 1, start: 0, last: null, best: null };
export function lapStep(lap: Lap, gate: number, now: number): Lap {
  if (gate < 0) return lap;
  if (gate === 0) {
    if (lap.running && lap.next === COURSE_GATES.length) {
      const time = now - lap.start;
      return { running: true, next: 1, start: now, last: time, best: lap.best === null ? time : Math.min(lap.best, time) };
    }
    return lap.running && lap.next > 1 ? lap : { ...lap, running: true, next: 1, start: now };
  }
  if (lap.running && gate === lap.next) return { ...lap, next: lap.next + 1 };
  return lap;
}

/**
 * A scripted lap: waypoints with the move to make on reaching each one. Drives
 * the lap test and the evidence recording (`__move.autopilot()` in dev); it is
 * not a player feature.
 */
/** `crouch` holds the crouch/slide key on the way to this waypoint (a slide at speed; a jump there is a slide-jump). */
export interface RouteStep { to: [number, number]; sprint?: boolean; crouch?: boolean; move?: "jump" | "long-dash" | "dash-jump" | "mantle" | "dash" | "hops" | "glide" | "glide-gust"; r?: number }
export const LAP_ROUTE: RouteStep[] = [
  { to: [-17, -17.5] },
  { to: [-17, 15], sprint: true, r: 1 }, // the sprint lane
  { to: [-15.5, 20.8], sprint: true, r: 1 },
  { to: [-11.3, 21], sprint: true, move: "jump", r: 0.35 }, // 2 tiles
  { to: [-3.4, 21], sprint: true, move: "jump", r: 0.35 }, // 3 tiles: a long jump at sprint speed
  { to: [6.8, 21], sprint: true, move: "long-dash", r: 0.35 }, // 4 tiles: long jump, then the air dash
  { to: [13.5, 21], sprint: true, r: 1 },
  { to: [20, 13], sprint: true, r: 0.6 },
  { to: [20, 4.5], r: 0.4 }, // past the building
  { to: [17, 3.8], r: 0.3 },
  { to: [17, 1], r: 0.4 }, // the gap in the fence
  { to: [17.4, -3], r: 0.5 },
  { to: [17.3, -8.5], r: 0.5 }, // between the rocks
  { to: [17, -11], r: 0.5 },
  { to: [15.5, -13.5], r: 0.5 },
  { to: [15.5, -16.5], r: 0.5 }, // round the bench
  { to: [15.5, -20], sprint: true, r: 0.5 },
  { to: [14.25, -20], move: "mantle", r: 0.15 }, // the first cliff
  { to: [11, -22.5], r: 0.5 },
  { to: [7.25, -22.5], move: "mantle", r: 0.15 }, // the second level
  { to: [5, -21], sprint: true, r: 0.6 },
  { to: [-4, -21], sprint: true, r: 0.8 }, // off the top: the 3u drop
  { to: [-6, -21], r: 0.3 },
  { to: [-12, -21], r: 0.4 }, // the narrow bridge
  { to: [-17, -19.5], r: 0.6 },
  { to: [-17, -15], r: 0.6 }, // the start line: lap
];

/** Input for each step along a route; returns null when the route is done. */
export function routePilot(route: readonly RouteStep[] = LAP_ROUTE) {
  let i = 0, phase = 0, t = 0, hold = false;
  return (s: { x: number; z: number; y: number; vy: number; mode: string; vx: number; vz: number }, dt: number) => {
    if (i >= route.length) return null;
    const step = route[i], next = route[i + 1] ?? step;
    const aim = (p: [number, number]) => { const dx = p[0] - s.x, dz = p[1] - s.z, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d, d }; };
    const go = aim(step.to);
    const base = { x: go.x, z: go.z, sprint: !!step.sprint, sneak: !!step.crouch, jump: hold, jumpPressed: false, dashPressed: false };
    if (phase === 0) {
      if (go.d > (step.r ?? 0.5)) return base;
      hold = false;
      if (!step.move) { i++; return { ...base, jump: false }; }
      // Hops: press Space and hold it to the next waypoint, a hop on every landing.
      if (step.move === "hops") { i++; hold = true; return { ...base, jump: true, jumpPressed: true }; }
      phase = 1; t = 0;
    }
    // The move: along the way to the next waypoint (into the wall for a mantle); Space held on the ground and rising, let go coming down so a landing does not hop again.
    t += dt;
    const along = step.move === "mantle" ? { x: Math.sign(next.to[0] - step.to[0]) || 0, z: 0 } : aim(next.to);
    const input = { ...base, x: along.x, z: along.z, sprint: !!step.sprint, jump: s.mode !== "air" || s.vy > 0 };
    if (phase === 1) {
      phase = 2;
      if (step.move === "dash-jump" || step.move === "dash") return { ...input, jump: false, dashPressed: true };
      return { ...input, jumpPressed: true };
    }
    if (step.move === "long-dash" && phase === 2 && s.mode === "air" && s.vy < 0) { phase = 3; return { ...input, dashPressed: true }; }
    // The glider: let go at the top of the jump, press again and hold to the landing (a gust half a second in).
    if (step.move === "glide" || step.move === "glide-gust") {
      if (phase === 2 && s.mode === "air" && s.vy <= 0) { phase = 3; return { ...input, jump: false }; }
      if (phase === 3) { phase = 4; t = 0; return { ...input, jump: true, jumpPressed: true }; }
      if (phase === 4) {
        if (s.mode === "ground") { i++; phase = 0; }
        const gust = step.move === "glide-gust" && t >= 0.5 && t < 0.5 + dt;
        return { ...input, jump: true, dashPressed: gust };
      }
    }
    if (step.move === "dash-jump" && phase === 2 && t > 0.06) { phase = 3; return { ...input, jumpPressed: true }; }
    if (t > 0.1 && s.mode === "ground") { i++; phase = 0; }
    return input;
  };
}
