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
import { Paint, createTerrain, sampleX, sampleZ, terrainHeight } from "./terrain";
import { hash01 } from "../worldFx";
import { JETTY, SELL_BARREL, dockToWorld } from "../wharf";
import type { ObjectKind } from "../villageMap";
import type { NEW_LAMPS } from "../propModels";

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
  coast?: number | Field;
  /** "land" (default) adds to the land; "water" carves a sea-level river or strait; "shape" only reshapes the ground. */
  kind?: "land" | "water" | "shape";
  paint?: number;
  /** Only below this height (the beach's sand stops where its ground climbs). */
  paintBelow?: number;
  /** How far its paint's edge wanders (a share of the blend, and twice that in height under `paintBelow`), squiggly and patchy. */
  ragged?: number;
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
// behind an invisible border, and the whole map pulled in round the village. R1c (his R1b notes, 2026-10-25): the map
// 10 u longer, one bigger islet with a cluster beside it, the wharf two thirds as deep and a little shorter, the village
// right up against it, the beach tapering off into the wharf, the forest rising gradually. R2b (his R2 notes, 2026-10-26):
// no stone step behind the deck boards, a grassy band at their level instead, the climb behind it; the meadow across the
// river lower.
// ---------------------------------------------------------------------------------------------------------------

/** The grid (unchanged from the village's conversion): width and depth in units, the north-west corner. */
const GRID = { width: 384, depth: 552, x0: -192, z0: -276 } as const;

/** Heights: David's picks, low to highest. */
export const H = { beach: 0.7, deck: 1, village: 3, meadow: 3.4, island: 4.5, islet: 2.4, forest: 9, m1: 16.5, m2: 25, summit: 31 } as const;

/** The main island's outline: radii round (-15, 5) every 22.5 degrees from +x toward +z (the beach is +z, the mountain -z). */
const MAIN = blob([-15, 5], [86, 82, 92, 100, 100, 99, 94, 92, 90, 93, 92, 101, 100, 101, 92, 89], 3, 18, 2);
/** The river: from its spring at the mountain's west foot, south down the meadow's side of the village to its mouth west of the beach. */
const RIVER: readonly XZ[] = [[-44, -22], [-46, 4], [-47, 22], [-48, 40], [-52, 58], [-58, 78], [-64, 98], [-72, 120]];
const westOfRiver = sideOf(RIVER);
/** The river's far bank (the meadow's side), easing back from it: a gentle slope down to the water, not a cliff (David, R2b: "make the other side more gradual"). */
const farBank: Field = (x, z) => smoothstep(-2, 2, westOfRiver(x, z)) * (1 - smoothstep(12, 20, westOfRiver(x, z)));
/**
 * The border (David: "invisible boarders for now that says release soon"): an invisible wall from the river, across the
 * meadow north of the village, to the sea north of the wharf, and on down the river's far bank to the sea (that bank
 * slopes gently to the water now, so a glide off the village could land on it). `layoutObjects` stands its segments;
 * the open area is south of it and east of the river.
 */
export const BORDER: readonly XZ[] = [[-52, 8], [-30, 10], [-8, 13], [14, 13], [36, 11], [56, 9], [84, 6]];
const FAR_BANK: readonly XZ[] = [[-52, 8], [-53.4, 22], [-54.8, 40], [-59.2, 58], [-65.6, 78], [-72, 98], [-80.5, 120], [-86, 130]];
export const BORDERS: readonly (readonly XZ[])[] = [BORDER, FAR_BANK];
const southOfBorder = sideOf(BORDER);
const OPEN: Field = (x, z) => Math.min(southOfBorder(x, z), -westOfRiver(x, z) - 1);
/** The shore along the wharf, north to south: the deck stands out to it, the grassy band and the climb step back from it. */
const QUAY: readonly XZ[] = [[69, 8], [73, 28], [74, 46], [73, 64], [66, 92]];
const westOfQuay = sideOf(QUAY);
/** The wharf's shore at the jetty (QUAY at z 46). */
const SHORE_X = 74;
/** The jetty (the wharf landmark, lib/game/wharf.ts JETTY): out to sea eastward, its gangways' ends (JETTY.land along it) just under the deck boards' edge 1 past the shore. */
export const DOCK = { x: SHORE_X + 0.8 + JETTY.land, z: 46, yaw: -Math.PI / 2 } as const;
/** A point `d` in from the wharf's shore at `z`, and the yaw that turns a square's local z inland there. */
function quayAt(z: number, d: number): { x: number; z: number; yaw: number } {
  let j = 0;
  while (j < QUAY.length - 2 && QUAY[j + 1][1] < z) j++;
  const [ax, az] = QUAY[j], [bx, bz] = QUAY[j + 1], len = Math.hypot(bx - ax, bz - az), f = (z - az) / (bz - az);
  const nx = -(bz - az) / len, nz = (bx - ax) / len;
  return { x: ax + (bx - ax) * f + nx * d, z: z + nz * d, yaw: Math.atan2(nx, nz) };
}
/** The beach's palms, bigger than the wharf's (David, R2c: "bigger trees"). */
const BEACH_PALM = 1.35;
/** The beach's campfire. */
const FIRE_AT = [14, 104] as const;
/** The deck squares' middles run from z to z (every 4 u): their south end stops where the grassy band still stands at their level. */
const DECK_Z = [14, 78] as const;
/**
 * The dirt path up to the village (David, R2b: "dirt needs to be more yellow and organic"; his path reference: "path
 * isnt perfectly straight"): off the deck boards south of the jetty, across the grassy band, winding up the climb to the
 * plaza. Points (x, z, height), the heights the climb's own at each.
 */
const PATH: readonly (readonly [number, number, number])[] = [[65.5, 56, H.deck], [61, 57.5, H.deck], [57, 60, 1.45], [53, 59.5, 2.45], [49.5, 56.5, H.village], [46, 53, H.village], [43, 51, H.village]];
/** The plaza's centre and radius (its stone). */
export const PLAZA: { at: XZ; r: number } = { at: [30, 50], r: 12 };

/** The mountain as R1 drew it round (4, -142), moved in to (0, -47) and shrunk to 0.62 (David: "have the mountain and allat moved closer", then "very slightly longer"). */
const MT = { from: [4, -142] as XZ, to: [0, -47] as XZ, s: 0.62 };
const inMt = (f: Field): Field => (x, z) => MT.s * f(MT.from[0] + (x - MT.to[0]) / MT.s, MT.from[1] + (z - MT.to[1]) / MT.s);
const mt = (x: number, z: number): [number, number] => [MT.to[0] + (x - MT.from[0]) * MT.s, MT.to[1] + (z - MT.from[1]) * MT.s];
const mtLabel = (text: string, x: number, z: number) => [text, ...mt(x, z)] as const;

const [PX, PZ] = PLAZA.at;
/** The plaza's buildings, a little closer in than R2c's (David, R2c: "have building come together slightly closer"). */
const SPOT = { hq: [PX - 17.5, PZ], cafe: [PX + 3, PZ - 16.2], shop: [PX + 3, PZ + 16], museum: [PX - 26, PZ + 20.5] } as const;
const VILLAGE = blob([PX + 2, 52], [42, 44, 42, 44, 50, 52, 38, 42], 2, 12, 81);
/**
 * The sushi bar (the sushi-bar lane's long open bar, 9.2 by 6.1, its back window to the sea): on the sand by the wharf's
 * end, its back (local -z) turned to the open sea south-east, its customers' deck toward the way down from the village,
 * on a level pad 0.9 high.
 */
const SUSHI = [44, 96.5] as const;
const BEACH = strip([[58, 92], [40, 100], [10, 105], [-20, 105], [-50, 101]], 9, 8, 0.8, 16, 95);

/**
 * How fast the seabed falls away from the shore: off the beach (east of the river's mouth) the shelf runs out 2.5 times
 * as far, a wide wading shallows (David, R2c: "make the shallow water area bigger and you can dip your toes in water").
 */
const shoal = (x: number, z: number) => 1 - 0.6 * smoothstep(-22, -4, BEACH(x, z)) * smoothstep(-46, -38, x);
/** At the village's level, rolling a little, rising a touch toward the mountain: no sudden rise anywhere; across the river 1.5 lower (David: "slighly shorter by 1-2 blocks"). */
const meadowGround = (x: number, z: number) => H.meadow + wob(x, z, 0.8, 40, 11) + 1.6 * smoothstep(0, -50, z) - 1.5 * smoothstep(0, 12, westOfRiver(x, z));
const forestGround = (x: number, z: number) => {
  // Hilly and bent: hills on a warped grid, so ridges curve.
  const wx = x + 9 * (fbm(x / 30, z / 30, 21) - 0.5), wz = z + 9 * (fbm(x / 30, z / 30, 22) - 0.5);
  return H.forest + 2.2 * (2 * fbm(wx / 19, wz / 19, 23) - 1);
};
/** The forest and ruins: the island's north-east between the mountain and the sea. */
const FOREST: Field = (x, z) => Math.min(MAIN(x, z), x - 26 + wob(x, z, 6, 16, 13), -4 - z + wob(x, z, 5, 14, 14));
/** The mountain's foot (its first layer's outline). */
const MT_FOOT = inMt(blob([4, -142], [66, 60, 64, 58, 62, 58, 70, 62], 5, 15, 61));
const hilly = (base: number, amp: number, scale: number, seed: number) => (x: number, z: number) => base + amp * (2 * fbm(x / scale, z / scale, seed) - 1);

export const PLAN: Plan = {
  base: H.beach,
  zones: [
    // THE MAIN ISLAND: one landmass at the village's level (so no seam dips between zones); the zones below shape it.
    { shape: MAIN, ground: H.village, edge: 3 },
    // MEADOW: at the village's level, gently rolling; everything past the border (north of the village, west of the river).
    { name: "Meadow", label: ["Meadow (rolling, 3 to 5)", -78, 20], shape: (x, z) => Math.min(MAIN(x, z), -OPEN(x, z)), ground: meadowGround, edge: 1.2, coast: (x, z) => 1.6 - 1.35 * farBank(x, z) },
    // NORTH ISLAND: smaller, hilly, a wide strait off the meadow (out of any glide); no bridgeheads yet.
    { name: "North island", label: ["North island (hilly, 3 to 6)", -162, 10], shape: blob([-162, 10], [20, 24, 44, 24, 20, 24, 42, 24], 3, 12, 5), ground: hilly(H.island, 1.6, 18, 31), edge: 3, coast: 1.4 },
    // ISLETS: low, hilly; one bigger islet and a cluster of small ones close beside it (David: "1 bigger with a bunch of
    // small close together"); boats open them later.
    { name: "Islands biome: boat later", label: ["Islets (low, 1 to 4)", 26, 186], shape: ellipse([26, 184], 38, 18, -0.3, 3, 12, 41), ground: hilly(H.islet, 1.6, 14, 42), edge: 2, coast: 1.2 },
    { name: "Islands biome: boat later", shape: ellipse([82, 168], 7, 5, 0.4, 1, 5, 43), ground: hilly(H.islet, 1, 6, 44), edge: 1.5, coast: 1.6 },
    { name: "Islands biome: boat later", shape: ellipse([95, 180], 5, 4, 0, 1, 5, 45), ground: H.islet + 0.6, edge: 1.5, coast: 2.2 },
    { name: "Islands biome: boat later", shape: ellipse([80, 186], 6, 4.5, 0.6, 1, 5, 46), ground: H.islet, edge: 1.5, coast: 1.4 },
    { name: "Islands biome: boat later", shape: ellipse([92, 197], 4, 3.5, 0.2, 0.8, 4, 47), ground: H.islet + 0.4, edge: 1.2, coast: 2 },
    { name: "Islands biome: boat later", shape: ellipse([105, 168], 3.5, 3, 0, 0.6, 4, 49), ground: H.islet + 0.8, edge: 1.2, coast: 2.5 },
    // LIGHTHOUSE ISLET: small and well off shore, south-east of the wharf, out of the boat's way in.
    { name: "Lighthouse islet", label: ["Lighthouse islet", 126, 114], shape: ellipse([126, 104], 5.5, 4.5, 0.3, 0.6, 4, 51), ground: H.islet, edge: 1.2, coast: 2 },
    // FOREST AND RUINS: high, hilly and bent, the island's north-east between the mountain and the sea, well back from
    // the wharf: a gradual rise out of the meadow, in two long tiers.
    {
      name: "Ruins in forest", label: ["Forest and ruins (hilly, 7 to 11)", 48, -30],
      shape: FOREST, ground: forestGround, edge: 6, tiers: [0.5, 0.5], ledge: 9, coast: 2.5,
    },
    // MOUNTAIN: the highest point, as R1 drew it, moved in behind the meadow. Layered cliffs, each layer a shelf; peaks standing off its sides.
    { name: "Mountain", label: mtLabel("Mountain (layers at 16.5 and 25)", 20, -196), shape: MT_FOOT, ground: (x, z) => H.m1 + wob(x, z, 1, 20, 62), edge: 1.3, tiers: [0.4, 0.3, 0.3], ledge: 2.6, coast: 2.5 },
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
    { name: "Pond (dry until elevated water)", shape: inMt(ellipse([7, -104], 7, 5.5, 0.2, 0.8, 4, 73)), ground: H.m1 - 1.3, edge: 1.5, kind: "shape", paint: Paint.Rock },
    { name: "Cave mouth", shape: inMt(ellipse([17, -108], 3.5, 3, 0, 0, 4, 74)), ground: H.m1, edge: 0.8, kind: "shape" },
    // VILLAGE: dead level at 3 (so neighbouring pads agree) round the plaza, right up against the wharf's climb.
    {
      name: "Village (re-plan)", label: ["Village (flat, 3)", 4, 66],
      shape: (x, z) => Math.min(VILLAGE(x, z), westOfQuay(x, z) - 20), ground: H.village,
      edge: (_x, z) => 1.5 + 5 * smoothstep(60, 80, z), coast: 0.35,
    },
    // WHARF: the deck boards' ground at 1 along the water (the fish market, the huts), grass at their level behind
    // them (room for palms; David: "same level and grassy"), then a gentle climb to the village's 3; the village shows
    // from the jetty.
    {
      name: "Wharf", label: ["Wharf (deck 1)", 62, 80],
      shape: (x, z) => Math.min(westOfQuay(x, z), 40 - Math.abs(z - 50) + wob(x, z, 2, 8, 91), 26 - westOfQuay(x, z), OPEN(x, z)),
      ground: (x, z) => H.deck + (H.village - H.deck) * smoothstep(13, 24, westOfQuay(x, z)),
      // Its south end eases down into the beach (David, R2b: "tranition between grassy area sand and dock").
      edge: (_x, z) => 1 + 5 * smoothstep(70, 90, z), coast: 2.5,
    },
    // Under the deck boards (the `deck` squares, `scenery`) the ground is earth.
    { shape: (x, z) => Math.min(westOfQuay(x, z) + 1, 7.2 - westOfQuay(x, z), DECK_Z[1] + 2 - z, z - DECK_Z[0] + 2), ground: (_x, _z, _i, h) => h, edge: 0.5, kind: "shape", paint: Paint.Path },
    // BEACH: sea level, wide yellow sand from the river's mouth east, tapering off into the wharf's south end, smooth,
    // with dry sand at its back for palms.
    {
      name: "Beach", label: ["Beach (sea level)", 4, 124],
      shape: (x, z) => Math.min(BEACH(x, z), 0.4 * (60 - x) + wob(x, z, 2.5, 9, 96)), ground: H.beach + 0.3, edge: 5, coast: 0.12, paint: Paint.Sand, paintBelow: 2.4, ragged: 0.45,
    },
    // The sushi bar's pad: level sand under it and its customers' deck.
    { shape: blob([SUSHI[0] - 0.7, SUSHI[1] - 0.7], [5.8, 5.8, 5.8, 5.8], 0, 14, 1), ground: 0.9, edge: 1.5, kind: "shape" },
    // THE RIVER: sea level, down the meadow's side of the village (wide enough near the open area that no glide crosses it).
    { name: "River", label: ["River (sea level)", -80, 64], shape: strip(RIVER, 4, 7, 0.6, 9, 97), ground: 0, edge: 6, coast: (x, z) => 2.4 - 2.15 * farBank(x, z), kind: "water" },
  ],
  ramps: [
    { label: ["Dirt path", 56, 68], pts: PATH, half: 1.8, shoulder: 2.5, paint: Paint.Path },
    // The way down to the beach, past the shop.
    { pts: [[36, 80, H.village], [34, 92, 2], [31, 101, H.beach + 0.3]], half: 1.6, shoulder: 3, paint: Paint.Path },
    // Brick roads from the plaza to HQ, the café, the shop and the museum, and down the path's level stretch (David, R2c:
    // "have brick roads to the important shops"): the stone paint, drawn as village-art2's brick (splatMaterial).
    ...[[[PX - 10, PZ], SPOT.hq], [[PX + 3, PZ - 10], SPOT.cafe], [[PX + 3, PZ + 10], SPOT.shop], [[PX - 8, PZ + 6], SPOT.museum], [[43, 51], [49.5, 56.5]]].map(([a, b]): Ramp => (
      { pts: [[a[0], a[1], H.village], [b[0], b[1], H.village]], half: 1.3, shoulder: 0.6, paint: Paint.Stone })),
  ],
};

/** The border's invisible wall, as barrier segments (lib/game/barriers.ts "border") no longer than BORDER_SEGMENT. */
const BORDER_SEGMENT = 8;
function borderObjects(): World["objects"] {
  const out: World["objects"][number][] = [];
  for (const line of BORDERS) for (let j = 0; j + 1 < line.length; j++) {
    const [ax, az] = line[j], [bx, bz] = line[j + 1], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / BORDER_SEGMENT);
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
/** A lamp (lib/game/propModels.ts NEW_LAMPS) turned so its arm reaches toward (tx, tz). */
const lamp = (model: keyof typeof NEW_LAMPS, x: number, z: number, tx: number, tz: number) => {
  const yaw = +Math.atan2(-(tz - z), tx - x).toFixed(4);
  return { x, z, ...(yaw ? { yaw } : {}), model };
};
/**
 * The open area's objects (R1b: David's layout, specs/launch/terrain-v3.md): HQ at the back of the plaza (west, the far
 * side seen from the jetty), the café to its right (north), the shop to its left (south), the museum further out; the
 * spawn on the deck by the jetty, the beach's spot on the sand; benches, study tables and lamps round the plaza and up
 * the path. Ids the layout doesn't name keep their places; the border's segments are rebuilt.
 */
/** The plaza's buildings and houses, 15% bigger than R2's (David: "increase building sizes by 15%"). */
const BUILDING_SCALE = 1.32, HOUSE_SCALE = 1.15;
/** The fountain in the plaza's middle (David's plaza-fountain reference), 7.2 across. */
const FOUNTAIN_SCALE = 0.75;
const LAYOUT: Record<string, { x: number; z: number; yaw?: number; scale?: number; model?: string }> = {
  wharf: { ...DOCK, model: "jetty" }, default: { x: SHORE_X - 6, z: DOCK.z },
  plaza: { x: PX, z: PZ }, monument: { x: PX - 8.5, z: PZ },
  hq: { x: SPOT.hq[0], z: SPOT.hq[1], yaw: facing(1, 0.06), scale: BUILDING_SCALE },
  cafe: { x: SPOT.cafe[0], z: SPOT.cafe[1], yaw: facing(-0.08, 1), scale: BUILDING_SCALE },
  shop: { x: SPOT.shop[0], z: SPOT.shop[1], yaw: facing(-0.1, -1), scale: BUILDING_SCALE },
  museum: { x: SPOT.museum[0], z: SPOT.museum[1], yaw: facing(26, -20.5), scale: BUILDING_SCALE },
  oracle: { x: +mt(-2, -152)[0].toFixed(2), z: +mt(-2, -152)[1].toFixed(2), yaw: Math.PI },
  beach: { x: -8, z: 106 },
  "study-0": { x: PX - 5, z: PZ - 10 }, "study-1": { x: PX + 11, z: PZ - 10 }, "study-2": { x: PX - 5, z: PZ + 10 }, "study-3": { x: PX + 11, z: PZ + 10 },
  "bench-0": { x: PX - 9, z: PZ - 4 }, "bench-1": { x: PX - 9, z: PZ + 4 }, "bench-2": { x: PX + 13.5, z: PZ - 6 }, "bench-3": { x: PX + 13.5, z: PZ + 6 },
};

type Obj = World["objects"][number];
/** A point `s` units along the path's middle, `side` units off it, and the yaw that turns a model's x along it there. */
function onPath(s: number, side = 0): { x: number; z: number; yaw: number } {
  for (let j = 0; ; j++) {
    const [ax, az] = PATH[j], [bx, bz] = PATH[j + 1], len = Math.hypot(bx - ax, bz - az);
    if (s > len && j + 2 < PATH.length) { s -= len; continue; }
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    return { x: ax + ux * s - uz * side, z: az + uz * s + ux * side, yaw: Math.atan2(-uz, ux) };
  }
}
/** An object with its keys in the order the world file reads them back (format.ts), defaults left out, so it saves to the same bytes. */
const obj = (kind: ObjectKind, id: string, x: number, z: number, yaw = 0, scale = 1, model?: string): Obj => ({
  id, kind, x: +x.toFixed(2), z: +z.toFixed(2), ...(+yaw.toFixed(4) ? { yaw: +yaw.toFixed(4) } : {}), ...(scale !== 1 ? { scale } : {}), ...(model ? { model } : {}),
});
/** The village's resident houses (scenery shells, their doors closed) in the gaps round the plaza, by colourway, drawn in a little closer (David, R2b: "houses could come together a bit closer"; R2c: "slightly closer"). */
const HOUSE_IN = 0.84;
const HOUSES: readonly [number, number, string][] = ([
  [15, -15, "yellow"], [-14, -20, "red"], [-26, -12, "brown"], [-26, 12, "yellow"], [15, 16, "red"], [-10, 28, "brown"], [-8, -26, "brown"], [-36, 0, "red"],
] as const).map(([dx, dz, colour]) => [PX + HOUSE_IN * dx, PZ + HOUSE_IN * dz, colour]);
/** The fish market on the deck boards (quayAt's z and d, a turn off facing the water, a scale): stalls, carts, barrels and crates. */
const MARKET: readonly (readonly [model: string, z: number, d: number, turn: number, scale: number])[] = [
  // wharf-art's fish market (David's marlin-shop reference) on 2 x 2 of the inland deck squares, its awning toward the
  // water; the stalls either side of it and along the deck.
  ["fish-market", 34, 4.6, 0, 1],
  ...[22, 28, 40, 68, 74, 80].map(z => ["market-cart", z, 6, 0, 0.55] as const),
  ...[[25, 7.6], [25.7, 7], [30.6, 6.6], [43, 7.3], [71, 7.6], [77, 7.6], [77.7, 7], [19, 1.4], [63, 1.4]].map(([z, d]) => ["barrel", z, d, z, 0.07] as const),
  ...[[20, 1.2], [26.5, 1.3], [66, 1.2], [72.5, 1.3]].map(([z, d]) => ["crate", z, d, Math.PI / 2, 1] as const),
  ["shop-cart", 43.5, 3.5, 0.4, 1.5], ["shop-cart", 61, 3.5, -0.3, 1.5],
  // wharf-art's dock decor: nets heaped and over crates, crates under cloth, crates of fish tipped toward the walk.
  ["net-heap", 37.8, 2.2, 0.5, 1], ["crate-cloth", 23.8, 3.2, 0.3, 1], ["fish-crate", 36.9, 1.2, 0.2, 1],
  ["fish-crate", 69.8, 2.4, -0.2, 1], ["net-heap", 75.6, 2.4, 1.2, 1], ["crate-cloth", 64.5, 5.4, 0, 1], ["crate-net", 58.6, 6.3, 0.1, 1], ["net-heap", 18.4, 5.6, 2.1, 1],
];
/**
 * R2's scenery (David's notes and the coordinator's reading, specs/lanes/terrain-v3.md): deck boards over the wharf's
 * deck and the stairs up to the quay, the fish market on them, fences up the climb, lamps along the deck, the houses
 * round the plaza, the campfire, palms and parasols on the beach, the lighthouse on its islet, and the closures:
 * rockfall on the mountain way, the forest's edge on the forest way, a washed-out bridge over the river and an
 * unbuilt one toward the north island.
 */
function scenery(): Obj[] {
  const out: Obj[] = [];
  for (let z = DECK_Z[0]; z <= DECK_Z[1]; z += 4) for (const d of [1, 5]) { const q = quayAt(z, d); out.push(obj("deck", `deck-${out.length}`, q.x, q.z, q.yaw)); }
  MARKET.forEach(([model, z, d, turn, scale], i) => { const q = quayAt(z, d); out.push(obj("prop", `market-${i}`, q.x, q.z, q.yaw + Math.PI + turn, scale, model)); });
  // The quick-sell barrel outside the fish market (David, R2c: "a big barrel that you can sell outside for quick sell"):
  // E there opens the sell sheet (DefaultIslandWorld, by its id). The ACNH barrel at twice the market's until
  // wharf-art2's lands.
  { const q = quayAt(30, 2.2); out.push(obj("prop", SELL_BARREL, q.x, q.z, q.yaw, 0.15, "barrel")); }
  // The path's loose fencing (David: "the fencing is loosely there not a straight fencing but one with gaps", running
  // "up higher"): short runs and lone posts either side all the way up, bushes scattered behind them.
  let fence = 0, bush = 0;
  for (const side of [-2.8, 2.8]) for (let s = 3, n = side > 0 ? 7 : 0; s < 24; n++) {
    const h = hash01(n, 1), model = h < 0.45 ? "rustic-fence-a" : h < 0.8 ? "rustic-fence-b" : "rustic-post", len = h < 0.45 ? 2.3 : h < 0.8 ? 1.7 : 0.2;
    const q = onPath(s + len / 2, side), yaw = q.yaw + 0.15 * (hash01(n, 2) - 0.5), ex = (Math.cos(yaw) * len) / 2, ez = (-Math.sin(yaw) * len) / 2;
    // Where the path bends a straight run would cut across it: leave that one out.
    if (nearest(PATH, q.x + ex, q.z + ez).d > 2.6 && nearest(PATH, q.x - ex, q.z - ez).d > 2.6 && nearest(PATH, q.x, q.z).d > 2.6) out.push(obj("prop", `path-fence-${fence++}`, q.x, q.z, yaw, 1, model));
    s += len + 0.6 + 1.6 * hash01(n, 3);
  }
  for (const side of [-1, 1]) for (let s = 2; s < 25; s += 1.6 + 1.8 * hash01(bush, 4)) {
    if (hash01(bush, 5) < 0.3) { bush++; continue; }
    const q = onPath(s, side * (3.6 + 1.4 * hash01(bush, 6)));
    if (nearest(PATH, q.x, q.z).d < 3.2) { bush++; continue; }
    out.push({ id: `path-bush-${bush}`, kind: "bush", x: +q.x.toFixed(2), z: +q.z.toFixed(2), seed: bush++ });
  }
  // The path's edge stones (village-art's mossy rocks, at one and a half to twice their size), clear of its lanterns.
  for (let k = 0; k < 10; k++) for (const side of [-1, 1]) {
    const h = hash01(k, side + 20), q = onPath(2.5 + 2.5 * k + 0.8 * (h - 0.5), side * (2.15 + 0.3 * hash01(k, side + 21)));
    if (k % 2 && hash01(k, side + 22) < 0.5) continue;
    out.push(obj("prop", `path-rock-${k}-${side > 0 ? 1 : 0}`, q.x, q.z, h * 6.28, +(1.5 + 0.5 * hash01(k, side + 23)).toFixed(2), ["path-rock-slab", "path-rock-low", "path-rock-cluster"][(k + (side > 0 ? 1 : 0)) % 3]));
  }
  // Palms (wharf-art's, in four sizes, the small ones at the edges of each group) on the grassy band behind the boards.
  ([[18, 10.5, "tall"], [16.5, 12.6, "small"], [25, 11.5, "short"], [32, 10, "lean"], [34, 12.2, "small"], [39, 11, "tall"], [62, 10.5, "short"], [64, 12.6, "small"],
    [68, 11, "tall"], [75, 10, "lean"], [82, 11.5, "short"], [80, 13, "small"]] as const)
    .forEach(([z, d, kind], i) => { const q = quayAt(z, d); out.push(obj("prop", `band-palm-${i}`, q.x, q.z, kind === "lean" ? 0 : z * 0.41, 1, `palm-${kind}`)); });
  // The dock's hoist at the deck's edge, its jib out over the water.
  { const q = quayAt(54, 0.4); out.push(obj("prop", "dock-hoist", q.x, q.z, q.yaw + Math.PI / 2, 1, "dock-hoist")); }
  out.push(obj("prop", "plaza-tiles", PX, PZ, 0, 1, "plaza-tiles"), obj("prop", "plaza-fountain", PX, PZ, 0, FOUNTAIN_SCALE, "plaza-fountain"));
  HOUSES.forEach(([x, z, colour], i) => out.push(obj("house", `house-${i + 1}`, x, z, facing(PX - x, PZ - z), HOUSE_SCALE, `chalet-${colour}`)));
  out.push(obj("campfire", "campfire", ...FIRE_AT, 0, 1.15));
  // Round it, clear of the sit and dance rings (lib/game/campfire.ts FIRE): log benches to sit on and stumps on the
  // landward side, the firewood stack and the fish rack a little back, two lanterns on their branches.
  const round = (deg: number, r: number) => { const a = (deg * Math.PI) / 180; return [FIRE_AT[0] + r * Math.cos(a), FIRE_AT[1] + r * Math.sin(a), +Math.atan2(-Math.cos(a), -Math.sin(a)).toFixed(4)] as const; };
  [0, 270, 180].forEach((deg, i) => { const [x, z, yaw] = round(deg, 4.3); out.push(obj("bench", `fire-bench-${i}`, x, z, yaw, 1, "log-bench")); });
  [225, 315, 135, 45].forEach((deg, i) => { const [x, z, yaw] = round(deg, 4.1); out.push(obj("prop", `fire-stump-${i}`, x, z, yaw + i, 1, "stump-seat")); });
  ([[240, 6.8, "firewood-stack"], [300, 7, "fish-rack"]] as const).forEach(([deg, r, model]) => { const [x, z, yaw] = round(deg, r); out.push(obj("prop", model, x, z, yaw, 1, model)); });
  ([[-42, 98, "tall"], [-39, 96.5, "small"], [-31, 98, "lean"], [-22, 99.5, "short"], [-19.5, 97.5, "small"], [2, 99, "tall"], [4.8, 97.4, "small"],
    [24, 99, "lean"], [30, 100, "short"], [27, 97.4, "small"], [52, 95, "tall"], [54.5, 96.6, "small"]] as const)
    .forEach(([x, z, kind], i) => out.push(obj("prop", `palm-${i}`, x, z, kind === "lean" ? -Math.PI / 2 : x * 0.37, BEACH_PALM, `palm-${kind}`)));
  [[-30, 109], [-22, 110], [28, 108]].forEach(([x, z], i) => out.push(obj("prop", `parasol-${i}`, x, z, x * 0.21, 1, "beach-parasol")));
  out.push(...plazaSet(), ...beachSet(), ...lamps(), ...nature(), ...boulders());
  out.push(obj("prop", "lighthouse", 126, 104, -0.6, 0.2, "lighthouse"));
  out.push(obj("barrier", "slide-mountain", 26, 8.5, 0.1, 1.4, "rockslide"));
  out.push(obj("barrier", "edge-forest-0", 58, 6.5, 0.1, 1, "forest-edge"), obj("barrier", "edge-forest-1", 66, 5.6, 0.1, 1, "forest-edge"));
  out.push(obj("barrier", "bridge-river", -41, 52, Math.PI / 2, 1.2, "unbuilt-bridge"), obj("barrier", "bridge-north", -100, 8, 0, 1.4, "unbuilt-bridge"));
  return out;
}

/** A point `r` from the plaza's centre at `deg` (from +x toward +z). */
const onPlaza = (deg: number, r: number): [number, number] => [PX + r * Math.cos((deg * Math.PI) / 180), PZ + r * Math.sin((deg * Math.PI) / 180)];
/** The yaw that turns a model's front (+z) toward (dx, dz). */
const front = (dx: number, dz: number) => Math.atan2(dx, dz);
/**
 * The plaza's dressing (village-art's set; David's plaza references: "flag and banner and stuff and less empty more
 * styff everywhere ... fruit barrel and crates outside fruit shops"): flags round the rim, banner poles with bunting
 * between them where the path comes in and its sign, planter benches round the fountain, planters by HQ and the café,
 * the fruit stall with its barrels and crates by the shop.
 */
function plazaSet(): Obj[] {
  const out: Obj[] = [];
  [25, 155, 205, 335].forEach((deg, i) => out.push(obj("prop", `plaza-flag-${i}`, ...onPlaza(deg, 12.8), deg * 0.05, 1, "flag-pole")));
  // The bunting hangs from the banner poles' tops (NatureModels lifts it), 6 u between them.
  out.push(obj("prop", "plaza-banner-0", PX + 12.5, PZ - 2, 0, 1, "banner-pole"), obj("prop", "plaza-banner-1", PX + 12.5, PZ + 4, 0, 1, "banner-pole"));
  out.push(obj("prop", "plaza-bunting", PX + 12.5, PZ + 1, -Math.PI / 2, 1.5, "bunting-string"), obj("prop", "plaza-sign", PX + 14, PZ - 3.4, Math.PI / 2, 1, "market-sign"));
  [45, 135, 225, 315].forEach((deg, i) => { const [x, z] = onPlaza(deg, 6.4); out.push(obj("prop", `plaza-bench-${i}`, x, z, front(PX - x, PZ - z), 1, "planter-bench")); });
  out.push(obj("prop", "plaza-planter-0", PX - 13, PZ - 2.6, Math.PI / 2, 1, "flower-planter"), obj("prop", "plaza-planter-1", PX - 13, PZ + 2.6, Math.PI / 2, 1, "flower-planter"));
  out.push(obj("prop", "plaza-pot-0", PX - 1.5, PZ - 12.6, 0, 1, "round-planter"), obj("prop", "plaza-pot-1", PX + 7.5, PZ - 12.6, 0, 1, "round-planter"));
  out.push(obj("prop", "fruit-stall", PX - 3, PZ + 12.2, Math.PI, 1, "fruit-stall"));
  ([[PX - 5.6, PZ + 12.6, "fruit-barrel"], [PX - 6.2, PZ + 11.8, "fruit-barrel"], [PX - 0.4, PZ + 12.7, "fruit-crate"], [PX + 6.6, PZ + 12.6, "fruit-crate"],
    [PX + 7.2, PZ + 11.9, "fruit-barrel"], [PX + 1.2, PZ + 12.8, "flower-pot"], [PX + 4.8, PZ + 12.8, "flower-pot"]] as const)
    .forEach(([x, z, model], i) => out.push(obj("prop", `plaza-shop-${i}`, x, z, i * 0.7, 1, model)));
  return out;
}

/**
 * The beach (wharf-art's set; David: "a sushi bar ... coral in the shallow waters ... some surfboard sticking in the sand,
 * a life guard tower"): the sushi bar by the wharf's end, its shark's mouth toward the way down from the village, the
 * lifeguard tower facing the sea, surfboards in twos and threes. The coral comes after the ground (`shallows`).
 */
function beachSet(): Obj[] {
  const out: Obj[] = [obj("prop", "sushi-bar", ...SUSHI, facing(1, 1), 1, "sushi-bar"), obj("prop", "lifeguard-tower", 1, 108.5, 0, 1, "lifeguard-tower")];
  ([[4.5, 107.4, "a"], [5.1, 107.8, "b"], [5.7, 107.3, "c"], [-16, 107, "c"], [-15.4, 107.5, "a"], [33, 104, "b"], [33.6, 104.4, "a"]] as const)
    .forEach(([x, z, m], i) => out.push(obj("prop", `surfboard-${i}`, x, z, 0.4 * (hash01(i, 30) - 0.5) + (x > 30 ? 2.6 : 0), 1, `surfboard-${m}`)));
  return out;
}

/**
 * The lights (David, R2b: "more lighting and stronger is needed ... it should be viby"; his lamp and lantern references):
 * wood and branch lamp posts up the path and hand lanterns at its sides, lamps round the plaza, lantern posts along the
 * deck and on the jetty's platform, hand lanterns along the deck's edge and all over the jetty, round the campfire (the
 * sushi bar lights itself). A hand lantern glows without a pool of light of its own (DefaultIslandWorld lampSets).
 */
function lamps(): Obj[] {
  const out: Obj[] = [], at = { x: 0, z: 0 };
  const put = (id: string, model: keyof typeof NEW_LAMPS, x: number, z: number, tx = x + 1, tz = z) => { const l = lamp(model, x, z, tx, tz); out.push(obj("lamp", id, l.x, l.z, l.yaw ?? 0, 1, l.model)); };
  [3, 8, 13, 18, 23].forEach((s, i) => { const q = onPath(s, i % 2 ? 2.4 : -2.4), c = onPath(s); put(`lamp-path-${i}`, i % 2 ? "branchPost" : "woodPost", q.x, q.z, c.x, c.z); });
  [5.5, 10.5, 15.5, 20.5].forEach((s, i) => [-1, 1].forEach(side => { const q = onPath(s + side * 0.6, side * 2.2); put(`lamp-path-hand-${i}-${side > 0 ? 1 : 0}`, "hand", q.x, q.z); }));
  ([[PX - 11, PZ - 9], [PX + 14, PZ - 10], [PX - 11, PZ + 9], [PX + 14, PZ + 10], [PX - 4.5, PZ - 13.5], [PX - 15, PZ + 15]] as const).forEach(([x, z], i) => put(`lamp-plaza-${i}`, "village", x, z, PX, PZ));
  put("lamp-beach-way", "village", 39, 84, 35, 84);
  // The deck: lantern posts mid-deck clear of the stalls, their arms toward the water; hand lanterns along its edge.
  [18, 25, 39, 51, 57, 65, 71, 77].forEach((z, i) => { const q = quayAt(z, 3.8), e = quayAt(z, 0); put(`lamp-deck-${i}`, "wharf", q.x, q.z, e.x, e.z); });
  for (let z = 15, i = 0; z <= 79; z += 5.5, i++) if (Math.abs(z - DOCK.z) > 5) { const q = quayAt(z, 0.1); put(`lamp-deck-hand-${i}`, "hand", q.x, q.z); }
  // The jetty: lantern posts on the platform and at the walkway's ends, a hand lantern at each pier's tip (David, R2c:
  // "make the dock bigger so it feels less clutter").
  ([[-3.2, 11.2], [3.2, 11.2], [-13.4, 2], [13.9, 2]] as const).forEach(([lx, lz], i) => { dockToWorld(DOCK, lx, lz, at); put(`lamp-jetty-${i}`, "wharf", at.x, at.z, at.x, DOCK.z); });
  ([[-0.7, -3.2], [-11.2, -9.2], [11.7, -6.2]] as const).forEach(([lx, lz], i) => { dockToWorld(DOCK, lx, lz, at); put(`lamp-jetty-hand-${i}`, "hand", at.x, at.z); });
  // The campfire: its two lanterns on branches and hand lanterns on the sand round it, outside its rings.
  [200, 340].forEach((deg, i) => { const a = (deg * Math.PI) / 180; put(`fire-lamp-${i}`, "camp", FIRE_AT[0] + 5.4 * Math.cos(a), FIRE_AT[1] + 5.4 * Math.sin(a), ...FIRE_AT); });
  [25, 65, 115, 155, 265, 320].forEach((deg, i) => { const a = (deg * Math.PI) / 180; put(`fire-hand-${i}`, "hand", FIRE_AT[0] + 6.3 * Math.cos(a), FIRE_AT[1] + 6.3 * Math.sin(a)); });
  return out;
}

/**
 * village-art2's mossy boulders (each set at the lowest ground under it: NatureModels propY): at the plaza's edges clear
 * of its roads, outside the path's bends, and along the river's near bank.
 */
function boulders(): Obj[] {
  const at: [number, number][] = [
    onPlaza(312, 14), onPlaza(228, 14.5), onPlaza(128, 14),
    ...([[9.4, 4.2], [13.6, -4.4], [18.2, 4.6]] as const).map(([s, side]): [number, number] => { const q = onPath(s, side); return [q.x, q.z]; }),
    [-40.5, 26], [-41.5, 45], [-45, 62], [-51, 82], [-53.5, 92],
  ];
  return at.map(([x, z], i) => obj("prop", `boulder-${i}`, x, z, hash01(i, 80) * 6.28, +(0.8 + 0.7 * hash01(i, 81)).toFixed(2), `moss-boulder-${i % 3 ? "a" : "b"}`));
}

/** The way down to the beach (the second ramp). */
const BEACH_WAY: readonly XZ[] = [[36, 80], [34, 92], [31, 101]];
/**
 * Lush nature round the village (David: "nature should feel like this [nature-feel.jpg] and not just empty"): trees,
 * bushes, flowers, village-art's wild-flower patches and tall grass, scattered over the open green on a jittered 4.5 u
 * grid, kept off the plaza, the paths, the buildings, the deck, the beach and the campfire.
 */
function nature(): Obj[] {
  const out: Obj[] = [];
  const buildings = [...["hq", "cafe", "shop", "museum"].map(id => [LAYOUT[id].x, LAYOUT[id].z, 10] as const), ...HOUSES.map(([x, z]) => [x, z, 6.5] as const)];
  for (let i = 0; i < 24; i++) for (let k = 0; k < 19; k++) {
    const x = -40 + i * 4.5 + 3.6 * (hash01(i, k + 40) - 0.5), z = 14 + k * 4.5 + 3.6 * (hash01(k, i + 41) - 0.5), h = hash01(i * 7 + k, 42);
    const path = nearest(PATH, x, z).d, tree = h < 0.13 && (i + k) % 2 === 0;
    if (OPEN(x, z) < 3 || MAIN(x, z) < 5 || Math.min(BEACH(x, z), 0.4 * (60 - x)) > -2 || westOfQuay(x, z) < 8.5 || Math.hypot(x - PX, z - PZ) < PLAZA.r + 3) continue;
    if (path < (tree ? 6 : 4) || nearest(BEACH_WAY, x, z).d < 3.5 || Math.hypot(x - FIRE_AT[0], z - FIRE_AT[1]) < 9 || buildings.some(([bx, bz, r]) => Math.hypot(x - bx, z - bz) < r)) continue;
    const id = `nature-${out.length}`, seed = Math.floor(hash01(i, k + 43) * 1000);
    // Trees in the three broadleaf shapes only (seed 0 to 2: lib/game/natureParts.ts), so they instance in few draws.
    if (tree) out.push({ id, kind: "tree", x: +x.toFixed(2), z: +z.toFixed(2), seed: seed % 3 });
    else if (h < 0.42) out.push({ id, kind: "bush", x: +x.toFixed(2), z: +z.toFixed(2), seed });
    else if (h < 0.62) out.push({ id, kind: "flower", x: +x.toFixed(2), z: +z.toFixed(2), seed });
    else out.push(obj("prop", id, x, z, h * 40, +(1 + 0.4 * hash01(i, k + 44)).toFixed(2), h < 0.82 ? "flower-meadow" : "flower-tallgrass"));
  }
  return out;
}

/**
 * The coral (wharf-art's) in the beach's shallows, past the wading: where the sea is 0.8 to 1.6 deep, in reefs, each
 * turned and sized its own way. From the generated ground, so it follows the seabed.
 */
function shallows(t: World["terrain"]): Obj[] {
  const out: Obj[] = [];
  for (let i = 0; i < 60; i++) for (let k = 0; k < 14; k++) {
    const x = -56 + i * 1.9 + 1.5 * (hash01(i, k + 60) - 0.5), z = 100 + k * 1.9 + 1.5 * (hash01(k, i + 61) - 0.5), h = hash01(i * 3 + k, 62);
    const depth = t.seaLevel - terrainHeight(t, x, z);
    // In reefs (David, R2c: "have coral reeffs"), with a few loners between.
    if ((fbm(x / 9, z / 9, 65) < 0.5 || h > 0.85) && h > 0.06) continue;
    if (depth < 0.8 || depth > 1.6) continue;
    out.push(obj("prop", `coral-${out.length}`, x, z, h * 21, +(0.8 + 0.5 * hash01(k, i + 63)).toFixed(2), `coral-${"abcd"[Math.floor(hash01(i, k + 64) * 4)]}`));
  }
  return out;
}

/**
 * The closed forest (David, R2c: "a low render for performance that also looks like busy forest over there but also look
 * natural"): many single low-poly trees (the far versions of our cedar and two broadleaf shapes, instanced: a few draws
 * for the lot), packed on a jittered 2.9 u grid over the whole forest off the mountain's foot and now and then left out,
 * mostly cedars, each turned and sized its own way (never stretched) and standing on its own ground.
 */
function forestTrees(): Obj[] {
  const out: Obj[] = [];
  for (let i = 0; i < 40; i++) for (let k = 0; k < 52; k++) {
    const x = 20 + i * 2.9 + 2.4 * (hash01(i, k) - 0.5), z = -140 + k * 2.9 + 2.4 * (hash01(k + 50, i) - 0.5), h = hash01(i * 31 + k, 7);
    if (FOREST(x, z) < 1 || MT_FOOT(x, z) > -2 || hash01(i + 70, k) < 0.08) continue;
    const model = h < 0.55 ? "forest-cedar" : h < 0.8 ? "forest-tall" : "forest-round";
    out.push(obj("prop", `forest-${out.length}`, x, z, hash01(k, i * 13) * 2 * Math.PI, +((model === "forest-cedar" ? 1.5 : 1.3) + 0.6 * hash01(i, k + 99)).toFixed(2), model));
  }
  return out;
}

/** The kinds only the generator places (every one of them is rebuilt each run). */
const GENERATED: ReadonlySet<string> = new Set(["deck", "prop", "house", "bush", "fence", "lamp", "tree", "flower"]);
/** The layout's moves, then the generated objects (the border and the scenery) in place of any earlier copy of them. */
export function layoutObjects(objects: World["objects"]): World["objects"] {
  const made = [...borderObjects(), ...scenery(), ...forestTrees()], ids = new Set(made.map(o => `${o.kind}:${o.id}`));
  const stale = (o: Obj) => GENERATED.has(o.kind) || ids.has(`${o.kind}:${o.id}`) || (o.kind === "barrier" && o.model === "border");
  return [...objects.filter(o => !stale(o)).map(o => (LAYOUT[o.id] ? { ...o, ...LAYOUT[o.id] } : o)), ...made];
}

/** The village's house and lot marks for David's editor session, in the gaps round the new plaza (5 x 5 cells each). */
const MARKS: Record<string, XZ> = {
  ...Object.fromEntries(HOUSES.slice(0, 6).map(([x, z], i) => [`House ${i + 1}`, [x, z] as XZ])),
  "Lot: future shop (street wall, south)": [PX + 14, 61], "Lot: future shop (street wall, north)": [PX + 14, 40],
  "Lot: workshop (sudo pets, P2+)": [PX - 38, 52], "Lot: future houses (west lane)": [PX - 40, 36],
  "Lot: future houses (north lane)": [PX - 30, 24], "Lot: civic expansion": [PX - 20, 84],
  "Boat arrival: first-login cutscene lands here": [DOCK.x + 2, DOCK.z],
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
      if (zn.coast !== undefined) g += ((typeof zn.coast === "number" ? zn.coast : zn.coast(x, z)) - g) * m;
      const jag = zn.ragged ? zn.ragged * (1.3 * (2 * fbm(x / 14, z / 14, 400 + j) - 1) + 0.5 * (hash01(i, k) - 0.5)) : 0;
      if (zn.paint !== undefined && m > 0.5 + jag) { painted[p] = zn.paint; below[p] = (zn.paintBelow ?? Infinity) + 2 * jag; }
    });
    for (const r of PLAN.ramps) {
      const { d: off, s } = nearest(r.pts, x, z), w = 1 - smoothstep(r.half, r.half + r.shoulder, off);
      if (w <= 0) continue;
      const j = Math.min(r.pts.length - 2, Math.floor(s)), f = s - j;
      h += (r.pts[j][2] + (r.pts[j + 1][2] - r.pts[j][2]) * f - h) * w;
      if (r.paint !== undefined && off < r.half) { painted[p] = r.paint; below[p] = Infinity; }
    }
    if (Math.hypot(x - PLAZA.at[0], z - PLAZA.at[1]) < PLAZA.r + wob(x, z, 0.6, 3, 99)) { painted[p] = Paint.Stone; below[p] = Infinity; }
    t.heights[p] = d <= 0 ? t.seaLevel - shelf(-d * shoal(x, z)) : t.seaLevel + softMin(h - t.seaLevel, g * d, 12);
  }
  rockRelief(t, 0.35, 2.2);
  const quays = wharfQuay(t, objects, shore);
  const pads = padBuildings(t, objects);
  const steepMoved = limitSteepness(t);
  strata(t);
  objects = [...objects.filter(o => !o.id.startsWith("coral-")), ...shallows(t)];

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
