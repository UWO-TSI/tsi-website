/**
 * Terrain v3 (specs/launch/terrain-v3.md, ledger row 318): the new world's landform from a zone plan, deterministic.
 * `web/scripts/generate-world.ts` runs it and writes `web/data/world/`. A note from David is an edit to `PLAN` and a
 * rerun; once he sculpts in the editor, only regional passes, never a full rerun over his work.
 *
 * HOW. Each zone is a soft shape (a signed distance, positive inside, its rim wobbling with noise), a ground (a height
 * or a profile), an edge (the half-width of its blend: narrow is a cliff, wide a slope) and a coast grade. The land is
 * the union of the land zones less the rivers; its shoreline is that union's 0 contour, so the coast is organic round
 * every zone. The heights stack in plan order: each zone pulls the ground toward its own inside its shape. Then the
 * ramps (paths graded through whatever they cross), then the coast as the conversion does it (land meets the still sea
 * exactly on the shoreline at the coast grade; the seabed shelves under it), then the wharf's quay, the building pads,
 * rock relief and the steepness limit, all from convert.ts.
 *
 * WHERE comes from David's drawing (specs/references/terrain/terrainv1.png, turned: the drawing's top is this map's
 * -x, its right this map's -z), pulled in round the village in R1b. SHAPE and HEIGHT come from his answers and notes.
 * R1b also lays out the open area's objects (`layoutObjects`) and the border's invisible wall.
 * Water stays at sea level (no elevated water yet): the mountain's pond is a dry basin, its falls dry channels.
 */
import { smoothstep, valueNoise, type MapAnnotation, type ShoreSdf } from "../grid";
import { CONVERT, contourDistance, limitSteepness, padBuildings, rockRelief, shelf, softMin, wharfQuay } from "./convert";
import type { World } from "./format";
import { Paint, createTerrain, sampleX, sampleZ } from "./terrain";

type XZ = readonly [number, number];
type Field = (x: number, z: number) => number;

/** Fractal value noise in [0, 1]. */
function fbm(x: number, z: number, seed: number, octaves = 3): number {
  let s = 0, a = 1, n = 0, f = 1;
  for (let o = 0; o < octaves; o++) { s += a * valueNoise(x * f, z * f, seed + o * 17); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

/** Noise in [-amp, amp], `scale` units across. */
const wob = (x: number, z: number, amp: number, scale: number, seed: number) => (amp ? amp * (2 * fbm(x / scale, z / scale, seed) - 1) : 0);

/**
 * A soft round shape round `at`: radii at even angles from +x turning toward +z, eased round (periodic Catmull-Rom),
 * its rim wobbling `wobble` units either way. Positive inside, about the distance to the rim.
 */
export function blob(at: XZ, radii: readonly number[], wobble = 0, scale = 14, seed = 1): Field {
  const n = radii.length, r = (i: number) => radii[((i % n) + n) % n];
  return (x, z) => {
    const dx = x - at[0], dz = z - at[1];
    const t = ((Math.atan2(dz, dx) / (2 * Math.PI)) * n + n) % n, i = Math.floor(t), f = t - i;
    const p0 = r(i - 1), p1 = r(i), p2 = r(i + 1), p3 = r(i + 2);
    const R = p1 + 0.5 * f * (p2 - p0 + f * (2 * p0 - 5 * p1 + 4 * p2 - p3 + f * (3 * (p1 - p2) + p3 - p0)));
    return R - Math.hypot(dx, dz) + wob(x, z, wobble, scale, seed);
  };
}

/** An ellipse (radii rx, rz, turned by `rot` toward +z) as a blob. */
export const ellipse = (at: XZ, rx: number, rz: number, rot = 0, wobble = 0, scale = 14, seed = 1): Field =>
  blob(at, Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * 2 * Math.PI - rot; return 1 / Math.hypot(Math.cos(a) / rx, Math.sin(a) / rz); }), wobble, scale, seed);

/** The nearest point of a polyline: its distance, and how far along it (segments, fractional). */
function nearest(pts: readonly (readonly number[])[], x: number, z: number): { d: number; s: number } {
  let best = Infinity, s = 0;
  for (let j = 0; j + 1 < pts.length; j++) {
    const [ax, az] = pts[j], [bx, bz] = pts[j + 1], ux = bx - ax, uz = bz - az;
    const f = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / (ux * ux + uz * uz)));
    const d = Math.hypot(x - ax - ux * f, z - az - uz * f);
    if (d < best) { best = d; s = j + f; }
  }
  return { d: best, s };
}

/** A band along a polyline, `half` wide either side (eased from the first point's half to `halfEnd` at the last). */
export function strip(pts: readonly XZ[], half: number, halfEnd = half, wobble = 0, scale = 10, seed = 1): Field {
  return (x, z) => { const { d, s } = nearest(pts, x, z); return half + (halfEnd - half) * (s / (pts.length - 1)) - d + wob(x, z, wobble, scale, seed); };
}

/** Which side of a polyline (signed distance, positive on the left of its direction of travel). */
export function sideOf(pts: readonly XZ[]): Field {
  return (x, z) => {
    const { d, s } = nearest(pts, x, z), j = Math.min(pts.length - 2, Math.floor(s));
    const [ax, az] = pts[j], [bx, bz] = pts[j + 1];
    return Math.sign((bx - ax) * (z - az) - (bz - az) * (x - ax)) * d;
  };
}

export interface Zone {
  /** The annotation it writes (its cells) and that sealed.test.ts matches; zones sharing a name share one. */
  name?: string;
  /** The top-down map's label and where it sits. */
  label?: readonly [string, number, number];
  /** Signed distance into it, positive inside. */
  shape: Field;
  /** Its ground: a height, or a profile given the distance inland from the shore and the ground so far. */
  ground: number | ((x: number, z: number, inland: number, h: number) => number);
  /** Half-width of its blend at the rim: narrow is a cliff, wide a slope. */
  edge: number | Field;
  /** Its rim as cliffs stacked, each set back a ledge (`ledge` units, varying) from the one below: each one's share of the rise, from the foot up. */
  tiers?: readonly number[];
  ledge?: number;
  /** Rise over run where it meets the sea (or, for a river, its banks). */
  coast?: number;
  /** "land" (default) adds to the land; "water" carves a sea-level river or strait; "shape" only reshapes the ground. */
  kind?: "land" | "water" | "shape";
  paint?: number;
  /** Only below this height (the beach's sand stops where its ground climbs; the quay's stone is the low tread). */
  paintBelow?: number;
}

/** A path graded through whatever it crosses: points (x, z, height), linear between them, `half` wide plus a `shoulder`. */
export interface Ramp {
  label?: readonly [string, number, number];
  pts: readonly (readonly [number, number, number])[];
  half: number;
  shoulder: number;
  paint?: number;
}

export interface Plan {
  /** The ground of land no zone covers. */
  base: number;
  zones: readonly Zone[];
  ramps: readonly Ramp[];
}

// ---------------------------------------------------------------------------------------------------------------
// THE PLAN. Heights in world units (the sea at -0.08; a jump is 1.28, a ledge grab 1.15 more). x east, z south on
// the top-down map. Zone order is stacking order. R1b (David's R1 notes, 2026-10-24, specs/lanes/terrain-v3.md): the
// wharf's deck at 1 and quay at 2, the village at 2 to 3, a bigger wharf and village, the meadow at the village's level
// behind an invisible border, and the whole map pulled in round the village.
// ---------------------------------------------------------------------------------------------------------------

/** The grid (unchanged from the village's conversion): width and depth in units, the north-west corner. */
const GRID = { width: 384, depth: 552, x0: -192, z0: -276 } as const;

/** Heights: David's picks, low to highest. */
export const H = { beach: 0.7, deck: 1, quay: 2, village: 3, meadow: 3.4, island: 4.5, islet: 2.4, forest: 9, m1: 16.5, m2: 25, summit: 31 } as const;

/** The main island's outline: radii round (-15, 5) every 22.5 degrees from +x toward +z (the beach is +z, the mountain -z). */
const MAIN = blob([-15, 5], [86, 82, 92, 100, 100, 99, 94, 92, 90, 90, 86, 92, 90, 92, 86, 86], 3, 18, 2);
/** The river: from its spring at the mountain's west foot, south down the meadow's side of the village to its mouth west of the beach. */
const RIVER: readonly XZ[] = [[-44, -14], [-46, 4], [-47, 22], [-48, 40], [-52, 58], [-58, 78], [-64, 98], [-72, 120]];
const westOfRiver = sideOf(RIVER);
/**
 * The border (David: "invisible boarders for now that says release soon"): an invisible wall from the river, across the
 * meadow north of the village, to the sea north of the wharf. `layoutObjects` stands its segments; the open area is
 * south of it and east of the river.
 */
export const BORDER: readonly XZ[] = [[-52, 8], [-30, 10], [-8, 13], [14, 13], [36, 11], [56, 9], [84, 6]];
const southOfBorder = sideOf(BORDER);
const OPEN: Field = (x, z) => Math.min(southOfBorder(x, z), -westOfRiver(x, z) - 1);
/** The shore along the wharf, north to south: the deck stands out to it, the quay and the climb step back from it. */
const QUAY: readonly XZ[] = [[69, 8], [73, 28], [74, 46], [73, 64], [66, 92]];
const westOfQuay = sideOf(QUAY);
/** The jetty (the wharf landmark): its land end at the shore, out to sea eastward. */
export const DOCK = { x: 74.5, z: 46, yaw: -Math.PI / 2 } as const;
/** The plaza's centre and radius (its stone). */
export const PLAZA: { at: XZ; r: number } = { at: [4, 50], r: 12 };

/** The mountain as R1 drew it round (4, -142), moved in to (-10, -42) and shrunk to 0.62 (David: "have the mountain and allat moved closer"). */
const MT = { from: [4, -142] as XZ, to: [-10, -42] as XZ, s: 0.62 };
const inMt = (f: Field): Field => (x, z) => MT.s * f(MT.from[0] + (x - MT.to[0]) / MT.s, MT.from[1] + (z - MT.to[1]) / MT.s);
const mt = (x: number, z: number): [number, number] => [MT.to[0] + (x - MT.from[0]) * MT.s, MT.to[1] + (z - MT.from[1]) * MT.s];
const mtLabel = (text: string, x: number, z: number) => [text, ...mt(x, z)] as const;

/** At the village's level, rolling a little, rising a touch toward the mountain: no sudden rise anywhere. */
const meadowGround = (x: number, z: number) => H.meadow + wob(x, z, 0.8, 40, 11) + 1.6 * smoothstep(0, -50, z);
const forestGround = (x: number, z: number) => {
  // Hilly and bent: hills on a warped grid, so ridges curve.
  const wx = x + 9 * (fbm(x / 30, z / 30, 21) - 0.5), wz = z + 9 * (fbm(x / 30, z / 30, 22) - 0.5);
  return H.forest + 2.2 * (2 * fbm(wx / 19, wz / 19, 23) - 1);
};
const hilly = (base: number, amp: number, scale: number, seed: number) => (x: number, z: number) => base + amp * (2 * fbm(x / scale, z / scale, seed) - 1);

export const PLAN: Plan = {
  base: H.beach,
  zones: [
    // THE MAIN ISLAND: one landmass at the village's level (so no seam dips between zones); the zones below shape it.
    { shape: MAIN, ground: H.village, edge: 3 },
    // MEADOW: at the village's level, gently rolling; everything past the border (north of the village, west of the river).
    { name: "Meadow", label: ["Meadow (rolling, 3 to 5)", -78, 20], shape: (x, z) => Math.min(MAIN(x, z), -OPEN(x, z)), ground: meadowGround, edge: 1.2, coast: 1.6 },
    // NORTH ISLAND: smaller, hilly, a wide strait off the meadow (out of any glide); no bridgeheads yet.
    { name: "North island", label: ["North island (hilly, 3 to 6)", -162, 10], shape: blob([-162, 10], [20, 24, 44, 24, 20, 24, 42, 24], 3, 12, 5), ground: hilly(H.island, 1.6, 18, 31), edge: 3, coast: 1.4 },
    // ISLETS: low, hilly, small; boats open them later.
    { name: "Islands biome: boat later", label: ["Islets (low, 1 to 4)", 36, 190], shape: ellipse([36, 190], 30, 13, -0.35, 3, 10, 41), ground: hilly(H.islet, 1.4, 12, 42), edge: 2, coast: 1.2 },
    { name: "Islands biome: boat later", shape: ellipse([-30, 170], 9, 7, 0.4, 1.5, 6, 43), ground: hilly(H.islet, 1.2, 8, 44), edge: 2, coast: 1.6 },
    { name: "Islands biome: boat later", shape: ellipse([-52, 194], 6, 5, 0, 1, 5, 45), ground: H.islet + 1, edge: 1.5, coast: 2.5 },
    { name: "Islands biome: boat later", shape: ellipse([84, 160], 6, 4.5, 0.6, 1, 5, 46), ground: H.islet, edge: 1.5, coast: 1.2 },
    { name: "Islands biome: boat later", shape: ellipse([2, 224], 8, 6, 0.2, 1.5, 6, 47), ground: hilly(H.islet + 0.5, 1, 7, 48), edge: 2, coast: 2 },
    { name: "Islands biome: boat later", shape: ellipse([74, 232], 5, 4, 0, 1, 5, 49), ground: H.islet + 1.5, edge: 1.5, coast: 2.5 },
    // LIGHTHOUSE ISLET: small and well off shore, south-east of the wharf, out of the boat's way in.
    { name: "Lighthouse islet", label: ["Lighthouse islet", 126, 114], shape: ellipse([126, 104], 5.5, 4.5, 0.3, 0.6, 4, 51), ground: H.islet, edge: 1.2, coast: 2 },
    // FOREST AND RUINS: high, hilly and bent, the island's north-east between the mountain and the sea, well back from
    // the wharf: foothills out of the meadow, then two tiers of cliff.
    {
      name: "Ruins in forest", label: ["Forest and ruins (hilly, 7 to 11)", 48, -30],
      shape: (x, z) => Math.min(MAIN(x, z), x - 26 + wob(x, z, 6, 16, 13), -4 - z + wob(x, z, 5, 14, 14)),
      ground: forestGround, edge: 3, tiers: [0.5, 0.5], ledge: 5, coast: 2.5,
    },
    // MOUNTAIN: the highest point, as R1 drew it, moved in behind the meadow. Layered cliffs, each layer a shelf; peaks standing off its sides.
    { name: "Mountain", label: mtLabel("Mountain (layers at 16.5 and 25)", 20, -196), shape: inMt(blob([4, -142], [66, 60, 64, 58, 62, 58, 70, 62], 5, 15, 61)), ground: (x, z) => H.m1 + wob(x, z, 1, 20, 62), edge: 1.3, tiers: [0.4, 0.3, 0.3], ledge: 2.6, coast: 2.5 },
    { name: "Mountain", shape: inMt(blob([-2, -150], [38, 34, 37, 36, 40, 36, 42, 34], 3.5, 11, 63)), ground: (x, z) => H.m2 + wob(x, z, 0.8, 16, 64), edge: 1.2, tiers: [0.4, 0.3, 0.3], ledge: 2.2 },
    { name: "Mountain", shape: inMt(ellipse([26, -168], 6, 7, 0, 1, 4, 65)), ground: 34, edge: 1.2 },
    { name: "Mountain", shape: inMt(ellipse([-30, -164], 7, 6, 0, 1, 4, 66)), ground: 30, edge: 1.2 },
    { name: "Mountain", shape: inMt(ellipse([21, -124], 4.5, 4.5, 0, 0.8, 4, 67)), ground: 28, edge: 1 },
    { name: "Mountain", shape: inMt(ellipse([-44, -116], 5, 4, 0.5, 0.8, 4, 68)), ground: 23, edge: 1 },
    { name: "Mountain", shape: inMt(ellipse([46, -112], 4, 5, 0, 0.8, 4, 69)), ground: 22, edge: 1 },
    { name: "Mountain", shape: inMt(ellipse([-50, -175], 6, 5, 0, 1, 4, 70)), ground: 24, edge: 1.2 },
    // The summit: the Oracle shrine's flat top (the Oracle stands on it: layoutObjects).
    { name: "Oracle Temple: the climb is the class pilgrimage", label: mtLabel("Summit 31 (Oracle)", -2, -172), shape: inMt(ellipse([-2, -152], 10, 9, 0, 0.8, 5, 71)), ground: H.summit, edge: 1.2 },
    // RIVERS AND FALLS: the small top fall's dry channel down the summit's south face and across layer 2 to the big
    // fall's lip; the big fall drops from layer 2 to layer 1 into a dry basin (the pond, once water can sit up here),
    // which drains into the cave; the river comes back out at the mountain's foot.
    { name: "Falls", label: mtLabel("Main fall", -26, -118), shape: inMt(strip([[-1, -143], [2, -128], [6, -113]], 1.6, 2.2, 0.3, 4, 72)), ground: (_x, _z, _i, h) => h - 0.7, edge: 0.6, kind: "shape", paint: Paint.Rock },
    { name: "Pond (dry until elevated water)", shape: inMt(ellipse([7, -104], 7, 5.5, 0.2, 0.8, 4, 73)), ground: H.m1 - 1.3, edge: 1.5, kind: "shape", paint: Paint.Stone },
    { name: "Cave mouth", shape: inMt(ellipse([17, -108], 3.5, 3, 0, 0, 4, 74)), ground: H.m1, edge: 0.8, kind: "shape" },
    // VILLAGE: dead level at 3 (so neighbouring pads agree) round the plaza, bigger; the climb from the quay is the 2 to 3.
    {
      name: "Village (re-plan)", label: ["Village (flat, 3)", -20, 60],
      shape: blob([6, 52], [42, 40, 36, 44, 50, 52, 38, 42], 2, 12, 81), ground: H.village,
      edge: (_x, z) => 1.5 + 5 * smoothstep(60, 80, z), coast: 0.35,
    },
    // WHARF: the deck boards' ground at 1 along the water (the fish market, the huts), the stone quay a step up at 2,
    // then a gentle climb to the village's 3, starting well inland.
    {
      name: "Wharf", label: ["Wharf (deck 1, quay 2)", 62, 76],
      shape: (x, z) => Math.min(westOfQuay(x, z), 44 - Math.abs(z - 50) + wob(x, z, 2, 8, 91), 38 - westOfQuay(x, z), OPEN(x, z)),
      ground: (x, z) => { const d = westOfQuay(x, z); return H.deck + (H.quay - H.deck) * smoothstep(13.4, 14.6, d) + (H.village - H.quay) * smoothstep(24, 36, d); },
      edge: 1, coast: 2.5, paint: Paint.Stone, paintBelow: 2.6,
    },
    // BEACH: sea level, wide yellow sand from the wharf's south end west to the river's mouth, smooth, with dry sand at its back for palms.
    {
      name: "Beach", label: ["Beach (sea level)", 4, 124],
      shape: strip([[62, 92], [40, 101], [10, 105], [-20, 105], [-50, 101]], 9, 8, 0.8, 16, 95), ground: H.beach + 0.3, edge: 5, coast: 0.12, paint: Paint.Sand, paintBelow: 2.4,
    },
    // THE RIVER: sea level, down the meadow's side of the village (wide enough near the open area that no glide crosses it).
    { name: "River", label: ["River (sea level)", -80, 64], shape: strip(RIVER, 4, 7, 0.6, 9, 97), ground: 0, edge: 6, coast: 2.4, kind: "water" },
  ],
  ramps: [
    // The jetty's land end (deck height 0 until R2 raises the pier) up onto the deck ground at 1.
    { pts: [[DOCK.x - 1.3, DOCK.z, 0], [DOCK.x - 5, DOCK.z, H.deck]], half: 1.6, shoulder: 1.5 },
    // The stone path: along the deck, up the stairs to the quay left of the jetty (south), then the gentle climb to the plaza.
    { label: ["Stone path", 44, 66], pts: [[DOCK.x - 5, DOCK.z, H.deck], [65, 52, H.deck], [62.5, 55, H.deck], [58, 57, H.quay], [50, 57.5, H.quay], [38, 56, H.village], [16, 52, H.village]], half: 1.8, shoulder: 2.5, paint: Paint.Stone },
    // The way down to the beach, past the shop.
    { pts: [[12, 78, H.village], [8, 90, 2], [3, 100, H.beach + 0.3]], half: 1.6, shoulder: 3, paint: Paint.Path },
  ],
};

/** The border's invisible wall, as barrier segments (lib/game/barriers.ts "border") no longer than BORDER_SEGMENT. */
const BORDER_SEGMENT = 8;
function borderObjects(): World["objects"] {
  const out: World["objects"][number][] = [];
  for (let j = 0; j + 1 < BORDER.length; j++) {
    const [ax, az] = BORDER[j], [bx, bz] = BORDER[j + 1], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / BORDER_SEGMENT);
    const yaw = +Math.atan2(-(bz - az), bx - ax).toFixed(4);
    for (let q = 0; q < n; q++) {
      const f = (q + 0.5) / n;
      // Keys in the order the world file reads them back (format.ts), so it saves back to the same bytes.
      out.push({ id: `border-${out.length}`, kind: "barrier", x: +(ax + (bx - ax) * f).toFixed(2), z: +(az + (bz - az) * f).toFixed(2), ...(yaw ? { yaw } : {}), scale: +((len / n) / BORDER_SEGMENT).toFixed(3), model: "border" });
    }
  }
  return out;
}

/** Facing a point: the yaw that turns a landmark's front (-z in its frame) toward (dx, dz). */
const facing = (dx: number, dz: number) => +Math.atan2(-dx, -dz).toFixed(4);
/**
 * The open area's objects (R1b: David's layout, specs/launch/terrain-v3.md): HQ at the back of the plaza (west, the far
 * side seen from the jetty), the café to its right (north), the shop to its left (south), the museum further out; the
 * spawn on the deck by the jetty, the beach's spot on the sand; benches, study tables and lamps round the plaza and up
 * the path. Ids the layout doesn't name keep their places; the border's segments are rebuilt.
 */
const [PX, PZ] = PLAZA.at;
const LAYOUT: Record<string, { x: number; z: number; yaw?: number }> = {
  wharf: DOCK, default: { x: DOCK.x - 6, z: DOCK.z },
  plaza: { x: PX, z: PZ }, monument: { x: PX + 3, z: PZ + 2 },
  hq: { x: PX - 19, z: PZ, yaw: facing(1, 0.06) },
  cafe: { x: PX + 3, z: PZ - 17.5, yaw: facing(-0.08, 1) },
  shop: { x: PX + 3, z: PZ + 17, yaw: facing(-0.1, -1) },
  museum: { x: PX - 28, z: PZ + 22, yaw: facing(28, -22) },
  oracle: { x: +mt(-2, -152)[0].toFixed(2), z: +mt(-2, -152)[1].toFixed(2), yaw: Math.PI },
  beach: { x: -8, z: 106 },
  "study-0": { x: PX - 5, z: PZ - 10 }, "study-1": { x: PX + 11, z: PZ - 10 }, "study-2": { x: PX - 5, z: PZ + 10 }, "study-3": { x: PX + 11, z: PZ + 10 },
  "bench-0": { x: PX - 9, z: PZ - 4 }, "bench-1": { x: PX - 9, z: PZ + 4 }, "bench-2": { x: PX + 13.5, z: PZ - 6 }, "bench-3": { x: PX + 13.5, z: PZ + 6 },
  "lamp-0": { x: 67, z: 50 }, "lamp-1": { x: 60.5, z: 53.5 }, "lamp-2": { x: 52, z: 55 }, "lamp-3": { x: 44, z: 54.5 }, "lamp-4": { x: 34, z: 53.5 },
  "lamp-5": { x: 24, z: 52.5 }, "lamp-6": { x: PX - 11, z: PZ - 9 }, "lamp-7": { x: PX + 14, z: PZ - 10 }, "lamp-8": { x: PX - 11, z: PZ + 9 },
  "lamp-9": { x: PX + 14, z: PZ + 10 }, "lamp-10": { x: 14, z: 82 },
};
export function layoutObjects(objects: World["objects"]): World["objects"] {
  return [...objects.filter(o => !(o.kind === "barrier" && o.model === "border")).map(o => (LAYOUT[o.id] ? { ...o, ...LAYOUT[o.id] } : o)), ...borderObjects()];
}

/** The village's house and lot marks for David's editor session, in the gaps round the new plaza (5 x 5 cells each). */
const MARKS: Record<string, XZ> = {
  "House 1": [24, 34], "House 2": [-10, 30], "House 3": [-20, 36], "House 4": [-20, 64], "House 5": [22, 66], "House 6": [-8, 76],
  "Lot: future shop (street wall, south)": [28, 60], "Lot: future shop (street wall, north)": [28, 42],
  "Lot: workshop (sudo pets, P2+)": [-34, 52], "Lot: future houses (west lane)": [-36, 36],
  "Lot: future houses (north lane)": [-26, 24], "Lot: civic expansion": [-16, 84],
  "Boat arrival: first-login cutscene lands here": [DOCK.x - 3, DOCK.z],
};
export function moveMarks(keep: readonly MapAnnotation[]): MapAnnotation[] {
  return keep.map(a => {
    const at = MARKS[a.name];
    if (!at) return a;
    const cx = Math.round(at[0] - GRID.x0), cz = Math.round(at[1] - GRID.z0), cells: [number, number][] = [];
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) cells.push([cx + dx, cz + dz]);
    return { ...a, cells };
  });
}

/**
 * Layered rock: on ground too steep to walk, the face is pulled toward a ledge every STRATA.band units of height, so a
 * cliff reads as stacked layers (the whole-island reference) rather than one smooth wall. Walkable ground is untouched.
 */
const STRATA = { band: 2, pull: 0.6 } as const;
function strata(t: World["terrain"]): void {
  const h = t.heights, c = t.cols, out = new Float32Array(h.length);
  for (let k = 1; k < t.rows - 1; k++) for (let i = 1; i < c - 1; i++) {
    const p = k * c + i;
    if (h[p] < t.seaLevel + 0.5) continue;
    const w = smoothstep(1.2, 2, Math.hypot(h[p + 1] - h[p - 1], h[p + c] - h[p - c]) * t.res / 2);
    if (w > 0) out[p] = w * STRATA.pull * (STRATA.band * Math.round(h[p] / STRATA.band) - h[p]);
  }
  for (let p = 0; p < h.length; p++) h[p] += out[p];
}

export interface GenerateReport { land: number; heights: [number, number]; quays: number; pads: number; steepMoved: number }

/**
 * The world from a plan: heights, paint and zone annotations; `objects` (already laid out: `layoutObjects`) stand on
 * their pads; `keep` are annotations carried over (the village's house and lot marks: `moveMarks`).
 */
export function generateWorld(objects: World["objects"], keep: readonly MapAnnotation[]): { world: World; report: GenerateReport } {
  const t = createTerrain(GRID.width, GRID.depth, GRID.x0, GRID.z0);
  const { cols, rows, res } = t, n = cols * rows;
  // The land: the union of the land zones, less the water.
  const L = new Float32Array(n).fill(-1e3);
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k);
    let l = -1e3, wet = -1e3;
    for (const zn of PLAN.zones) {
      if (zn.kind === "shape") continue;
      const d = zn.shape(x, z);
      if (zn.kind === "water") wet = Math.max(wet, d); else l = Math.max(l, d);
    }
    L[k * cols + i] = Math.min(l, -wet);
  }
  const inland = contourDistance(L, cols, rows, res, 0);
  const shore: ShoreSdf = { data: inland.map(v => -v), width: cols, height: rows, scale: res, minX: t.x0 - 0.5 / res, minZ: t.z0 - 0.5 / res, sizeX: cols / res, sizeZ: rows / res };

  // The ground, zone by zone, then the ramps, then the coast.
  const member = PLAN.zones.map(() => new Uint8Array(n));
  const painted = new Int8Array(n).fill(-1), below = new Float32Array(n);
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const p = k * cols + i, x = sampleX(t, i), z = sampleZ(t, k), d = inland[p];
    let h = PLAN.base, g = CONVERT.bank;
    PLAN.zones.forEach((zn, j) => {
      // The rim's steepness wanders along it (some faces sheer, some leaning), as a cliff does.
      const e = (typeof zn.edge === "number" ? zn.edge : zn.edge(x, z)) * (0.55 + 0.9 * fbm(x / 9, z / 9, 200 + j, 2));
      const sd = zn.shape(x, z), ledge = (zn.ledge ?? 3) * (0.6 + 0.8 * fbm(x / 11, z / 11, 300 + j, 2));
      let m = 0;
      (zn.tiers ?? [1]).forEach((share, q) => { m += share * smoothstep(-e, e, sd - q * ledge); });
      member[j][p] = m >= 0.5 ? 1 : 0;
      if (m <= 0) return;
      if (zn.kind !== "water") h += ((typeof zn.ground === "number" ? zn.ground : zn.ground(x, z, d, h)) - h) * m;
      if (zn.coast !== undefined) g += (zn.coast - g) * m;
      if (zn.paint !== undefined && m > 0.5) { painted[p] = zn.paint; below[p] = zn.paintBelow ?? Infinity; }
    });
    for (const r of PLAN.ramps) {
      const { d: off, s } = nearest(r.pts, x, z), w = 1 - smoothstep(r.half, r.half + r.shoulder, off);
      if (w <= 0) continue;
      const j = Math.min(r.pts.length - 2, Math.floor(s)), f = s - j;
      h += (r.pts[j][2] + (r.pts[j + 1][2] - r.pts[j][2]) * f - h) * w;
      if (r.paint !== undefined && off < r.half) { painted[p] = r.paint; below[p] = Infinity; }
    }
    if (Math.hypot(x - PLAZA.at[0], z - PLAZA.at[1]) < PLAZA.r + wob(x, z, 0.6, 3, 99)) { painted[p] = Paint.Stone; below[p] = Infinity; }
    t.heights[p] = d <= 0 ? t.seaLevel - shelf(-d) : t.seaLevel + softMin(h - t.seaLevel, g * d, 12);
  }
  rockRelief(t, 0.35, 2.2);
  const quays = wharfQuay(t, objects, shore);
  const pads = padBuildings(t, objects);
  const steepMoved = limitSteepness(t);
  strata(t);

  let land = 0, lo = Infinity, hi = -Infinity;
  for (let p = 0; p < n; p++) {
    const h = t.heights[p], dry = h > t.seaLevel;
    if (dry) land++;
    lo = Math.min(lo, h); hi = Math.max(hi, h);
    const want = painted[p];
    // Sand under the water and on any low shore; a zone's sand stops where its ground climbs.
    t.paint[p] = !dry || (want < 0 && h < t.seaLevel + 0.9 && inland[p] < 6) ? Paint.Sand : want >= 0 && h < below[p] ? want : Paint.Grass;
  }

  // The zones' annotations. A land zone owns the cells (centre inside it, on land) where its ground is the one on top
  // (the last in stacking order) and the ground stands at its height (not a cliff's foot or a coast's last slope down);
  // a river, a channel or a basin marks its cells as well.
  const cells = new Map<string, Set<number>>();
  for (let cz = 0; cz < t.depth; cz++) for (let cx = 0; cx < t.width; cx++) {
    const p = (cz * res + res / 2) * cols + cx * res + res / 2, c = cz * t.width + cx, h = t.heights[p];
    const x = sampleX(t, cx * res + res / 2), z = sampleZ(t, cz * res + res / 2);
    let owner: string | undefined;
    PLAN.zones.forEach((zn, j) => {
      if (!member[j][p]) return;
      const land = !zn.kind || zn.kind === "land";
      if (land) {
        const own = typeof zn.ground === "number" ? zn.ground : zn.ground(x, z, inland[p], h);
        if (h > t.seaLevel && h > own - 1.5) owner = zn.name;
        return;
      }
      if (zn.name) { const set = cells.get(zn.name) ?? new Set<number>(); set.add(c); cells.set(zn.name, set); }
    });
    if (owner) { const set = cells.get(owner) ?? new Set<number>(); set.add(c); cells.set(owner, set); }
  }
  const annotations: MapAnnotation[] = [...cells].map(([name, set]) => ({
    name, color: ZONE_COLOURS[name] ?? "#888888", cells: [...set].sort((a, b) => a - b).map(c => [c % t.width, Math.floor(c / t.width)] as [number, number]),
  }));
  const kept = keep.filter(a => !cells.has(a.name));
  return {
    world: { terrain: t, objects, annotations: [...annotations, ...kept], source: "generated from the zone plan (lib/game/world/generate.ts, scripts/generate-world.ts)" },
    report: { land, heights: [+lo.toFixed(2), +hi.toFixed(2)], quays, pads, steepMoved },
  };
}

const ZONE_COLOURS: Record<string, string> = {
  "Meadow": "#B5C77A", "North island": "#8FAE6B", "Islands biome: boat later": "#7FB3A8", "Lighthouse islet": "#E0C46C",
  "Ruins in forest": "#4E7A4A", "Mountain": "#8C8577", "Oracle Temple: the climb is the class pilgrimage": "#D9A441",
  "Falls": "#6FA8DC", "Pond (dry until elevated water)": "#6FA8DC", "Cave mouth": "#5B4B6B", "Village (re-plan)": "#C98F73",
  "Wharf": "#9C6B4E", "Beach": "#E8D29A", "River": "#4F8FC0",
};
