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
 * -x, its right this map's -z), and from the objects, which R1 does not move. SHAPE and HEIGHT come from his answers.
 * Water stays at sea level (no elevated water yet): the mountain's pond is a dry basin, its falls dry channels.
 */
import { smoothstep, valueNoise, type MapAnnotation, type ShoreSdf } from "../grid";
import { CONVERT, contourDistance, limitSteepness, padBuildings, rockRelief, shelf, softMin, wharfQuay } from "./convert";
import type { World } from "./format";
import { Paint, createTerrain, sampleX, sampleZ } from "./terrain";

type XZ = readonly [number, number];
type Field = (x: number, z: number) => number;

/** Fractal value noise in [0, 1]. */
export function fbm(x: number, z: number, seed: number, octaves = 3): number {
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

/** A smooth staircase: `riser` up at every `tread` from 0, each face `face` wide, topping out at `top`. */
export function stairs(d: number, riser: number, tread: number, face: number, top: number): number {
  let h = 0;
  for (let k = 0; k * riser < top - 1e-6; k++) h += riser * smoothstep(-face, face, d - k * tread);
  return Math.min(top, h);
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
// the top-down map. Zone order is stacking order.
// ---------------------------------------------------------------------------------------------------------------

/** Heights: David's picks, low to highest. */
export const H = { beach: 0.7, wharf: 0, village: 4.5, meadow: 7.5, island: 6, islet: 2.4, forest: 13, m1: 16.5, m2: 25, summit: 31 } as const;

/** The main island's outline: radii round (0, -40) every 22.5 degrees from +x toward +z (the beach is +z, the mountain -z). */
const MAIN = blob([0, -40], [95, 95, 88, 100, 158, 160, 113, 95, 88, 92, 99, 143, 175, 150, 113, 100], 4, 18, 2);
/**
 * The river: from its spring at the mountain's foot (where the pond's water comes back out of the cave), south through
 * the meadow, then round the village's west side to its mouth at the beach's west end.
 */
const RIVER: readonly XZ[] = [[2, -82], [-8, -62], [-4, -40], [-14, -18], [-10, 4], [-22, 22], [-36, 36], [-42, 58], [-56, 78], [-60, 100], [-72, 124], [-80, 150]];
const westOfRiver = sideOf(RIVER);
/** The open area (the village, the wharf and the beach) east of the river: the meadow's escarpment is its inland rim. */
const OPEN_ROUND = blob([8, 70], [70, 72, 80, 80, 70, 40, 37, 46], 4.5, 11, 4);
const OPEN: Field = (x, z) => Math.min(OPEN_ROUND(x, z), -westOfRiver(x, z) - 1);
/** The quay's edge, north to south: the wharf's land ends here, its terraces step up westward from it. */
const QUAY: readonly XZ[] = [[46, 22], [48.5, 50], [46.5, 80]];
const westOfQuay = sideOf(QUAY);

/** Never lower than a jump and a grab above the village with a unit to spare (7.9), so its escarpment closes it. */
const meadowGround = (x: number, z: number) => H.meadow + 1.7 + wob(x, z, 1.3, 42, 11) + 1.8 * smoothstep(-20, -80, z);
const forestGround = (x: number, z: number) => {
  // Hilly and bent: hills on a warped grid, so ridges curve.
  const wx = x + 9 * (fbm(x / 30, z / 30, 21) - 0.5), wz = z + 9 * (fbm(x / 30, z / 30, 22) - 0.5);
  return H.forest + 3 * (2 * fbm(wx / 19, wz / 19, 23) - 1);
};
const hilly = (base: number, amp: number, scale: number, seed: number) => (x: number, z: number) => base + amp * (2 * fbm(x / scale, z / scale, seed) - 1);

export const PLAN: Plan = {
  base: H.beach,
  zones: [
    // THE MAIN ISLAND: one landmass; the zones below shape it.
    { shape: MAIN, ground: H.beach, edge: 3 },
    // MEADOW: middle height, gently rolling, a slight rise toward the mountain; the middle of the island, north of the
    // village (an escarpment above it) and both sides of the river.
    { name: "Meadow", label: ["Meadow (rolling, 8 to 12)", -45, -20], shape: (x, z) => Math.min(MAIN(x, z), -OPEN(x, z)), ground: meadowGround, edge: 1.2, coast: 1.6 },
    // NORTH ISLAND: middle, hilly, a wide strait off the meadow (out of any glide), two bridgeheads facing the meadow's.
    { name: "North island", label: ["North island (hilly, 4 to 8)", -150, 8], shape: blob([-152, 8], [22, 28, 82, 30, 22, 28, 80, 28], 4, 14, 5), ground: hilly(H.island, 2.4, 22, 31), edge: 3, coast: 1.4 },
    { name: "North island", shape: strip([[-133, -38], [-121, -38]], 5, 5, 1, 6, 6), ground: H.island + 1, edge: 2, coast: 2.5 },
    { name: "North island", shape: strip([[-133, 46], [-121, 46]], 5, 5, 1, 6, 7), ground: H.island + 1, edge: 2, coast: 2.5 },
    { name: "Meadow", shape: strip([[-82, -38], [-93, -38]], 5, 5, 1, 6, 8), ground: H.meadow + 0.5, edge: 2, coast: 2.5 },
    { name: "Meadow", shape: strip([[-80, 46], [-93, 46]], 5, 5, 1, 6, 9), ground: H.meadow, edge: 2, coast: 2.5 },
    // ISLETS: low, hilly, small; boats open them later.
    { name: "Islands biome: boat later", label: ["Islets (low, 1 to 4)", 36, 190], shape: ellipse([36, 190], 30, 13, -0.35, 3, 10, 41), ground: hilly(H.islet, 1.4, 12, 42), edge: 2, coast: 1.2 },
    { name: "Islands biome: boat later", shape: ellipse([-30, 170], 9, 7, 0.4, 1.5, 6, 43), ground: hilly(H.islet, 1.2, 8, 44), edge: 2, coast: 1.6 },
    { name: "Islands biome: boat later", shape: ellipse([-52, 194], 6, 5, 0, 1, 5, 45), ground: H.islet + 1, edge: 1.5, coast: 2.5 },
    { name: "Islands biome: boat later", shape: ellipse([84, 160], 6, 4.5, 0.6, 1, 5, 46), ground: H.islet, edge: 1.5, coast: 1.2 },
    { name: "Islands biome: boat later", shape: ellipse([2, 224], 8, 6, 0.2, 1.5, 6, 47), ground: hilly(H.islet + 0.5, 1, 7, 48), edge: 2, coast: 2 },
    { name: "Islands biome: boat later", shape: ellipse([74, 232], 5, 4, 0, 1, 5, 49), ground: H.islet + 1.5, edge: 1.5, coast: 2.5 },
    // LIGHTHOUSE ISLET: smaller and further off than the drawn one, to the wharf's south-east, out of the boat's way in.
    { name: "Lighthouse islet", label: ["Lighthouse islet", 114, 106], shape: ellipse([114, 96], 5.5, 4.5, 0.3, 0.6, 4, 51), ground: H.islet, edge: 1.2, coast: 2 },
    // FOREST AND RUINS: high, hilly and bent, the island's east between the mountain and the wharf; it eases down into
    // the meadow and stands as a cliff over the village and the wharf.
    {
      name: "Ruins in forest", label: ["Forest and ruins (hilly, 10 to 16)", 50, -45],
      shape: (x, z) => Math.min(MAIN(x, z), x - 30 + wob(x, z, 6, 16, 13), 28 - z + wob(x, z, 3, 10, 14)),
      ground: forestGround, edge: (x, z) => 1.3 + 7 * smoothstep(36, 22, x) * smoothstep(18, 4, z), tiers: [0.65, 0.35], ledge: 3.5, coast: 2.5,
    },
    // MOUNTAIN: the highest point. Layered cliffs, each layer a shelf; peaks standing off its sides.
    { name: "Mountain", label: ["Mountain (layers at 16.5 and 25)", 20, -186], shape: blob([4, -142], [66, 60, 64, 58, 62, 58, 70, 62], 5, 15, 61), ground: (x, z) => H.m1 + wob(x, z, 1, 20, 62), edge: 1.3, tiers: [0.4, 0.3, 0.3], ledge: 3.5, coast: 2.5 },
    { name: "Mountain", shape: blob([-2, -150], [38, 34, 37, 36, 40, 36, 42, 34], 3.5, 11, 63), ground: (x, z) => H.m2 + wob(x, z, 0.8, 16, 64), edge: 1.2, tiers: [0.4, 0.3, 0.3], ledge: 3 },
    { name: "Mountain", shape: ellipse([26, -168], 6, 7, 0, 1, 4, 65), ground: 34, edge: 1.2 },
    { name: "Mountain", shape: ellipse([-30, -164], 7, 6, 0, 1, 4, 66), ground: 30, edge: 1.2 },
    { name: "Mountain", shape: ellipse([21, -124], 4.5, 4.5, 0, 0.8, 4, 67), ground: 28, edge: 1 },
    { name: "Mountain", shape: ellipse([-44, -116], 5, 4, 0.5, 0.8, 4, 68), ground: 23, edge: 1 },
    { name: "Mountain", shape: ellipse([46, -112], 4, 5, 0, 0.8, 4, 69), ground: 22, edge: 1 },
    { name: "Mountain", shape: ellipse([-50, -175], 6, 5, 0, 1, 4, 70), ground: 24, edge: 1.2 },
    // The summit: the Oracle shrine's flat top (the Oracle stands at (-2, -152)).
    { name: "Oracle Temple: the climb is the class pilgrimage", label: ["Summit 31 (Oracle)", -2, -164], shape: ellipse([-2, -152], 10, 9, 0, 0.8, 5, 71), ground: H.summit, edge: 1.2 },
    // RIVERS AND FALLS: the small top fall's dry channel down the summit's south face and across layer 2 to the big
    // fall's lip; the big fall drops from layer 2 to layer 1 into a dry basin (the pond, once water can sit up here),
    // which drains into the cave; the river comes back out at the mountain's foot.
    { name: "Falls", label: ["Main fall", -16, -118], shape: strip([[-1, -143], [2, -128], [6, -113]], 1.6, 2.2, 0.3, 4, 72), ground: (_x, _z, _i, h) => h - 0.7, edge: 0.6, kind: "shape", paint: Paint.Rock },
    { name: "Pond (dry until elevated water)", label: ["Pond", -10, -100], shape: ellipse([7, -104], 7, 5.5, 0.2, 0.8, 4, 73), ground: H.m1 - 1.3, edge: 1.5, kind: "shape", paint: Paint.Stone },
    { name: "Cave mouth", label: ["Cave", 26, -100], shape: ellipse([17, -108], 3.5, 3, 0, 0, 4, 74), ground: H.m1, edge: 0.8, kind: "shape" },
    // VILLAGE: middle, flat (dead level, so neighbouring pads agree), round the plaza; under the meadow's escarpment, a gentle slope down to the beach.
    {
      name: "Village (re-plan)", label: ["Village (flat, 4.5)", -12, 72],
      shape: blob([6, 64], [30, 32, 24, 32, 36, 32, 24, 30], 2, 12, 81), ground: H.village,
      edge: (_x, z) => 1.5 + 5 * smoothstep(52, 66, z), coast: 0.35,
    },
    // WHARF: low, terraced steps up from the quay to the village, following the shore.
    {
      name: "Wharf", label: ["Wharf (quay 0, terraces 1.5, 3)", 60, 66],
      shape: (x, z) => Math.min(westOfQuay(x, z), 30 - Math.abs(z - 51) + wob(x, z, 2, 8, 91), 26 - westOfQuay(x, z), OPEN(x, z)),
      ground: (x, z) => stairs(westOfQuay(x, z) - 5, 1.5, 5.5, 0.6, H.village), edge: 1, coast: 2.5, paint: Paint.Stone, paintBelow: 0.6,
    },
    // BEACH: sea level, wide yellow sand from the wharf's south end west to the river's mouth.
    {
      name: "Beach", label: ["Beach (sea level)", 4, 128],
      shape: strip([[50, 88], [28, 100], [0, 106], [-28, 106], [-50, 102]], 11, 10, 2, 12, 95), ground: H.beach, edge: 5, coast: 0.12, paint: Paint.Sand, paintBelow: 2.2,
    },
    // THE RIVER: sea level, in a gorge through the meadow and round the village's west side (the meadow's closure there).
    { name: "River", label: ["River (sea level, in a gorge)", -64, 72], shape: strip(RIVER, 3, 6, 0.8, 9, 97), ground: 0, edge: 6, coast: 2.4, kind: "water" },
  ],
  ramps: [
    // The stone path from the quay up the terraces to the plaza (stairs go on it in R2).
    { label: ["Stone path", 30, 44], pts: [[46, 50.5, 0], [40, 52, 1.6], [33, 53.5, H.village], [16, 58, H.village]], half: 1.8, shoulder: 2.5, paint: Paint.Stone },
    // The way down to the beach, from past the museum's front.
    { pts: [[16, 80, H.village], [10, 90, 2.2], [2, 99, H.beach + 0.1]], half: 1.6, shoulder: 3, paint: Paint.Path },
    // The meadow way: climbs from behind the plaza up the escarpment and breaks off below its rim (a landslide).
    { label: ["Meadow way (slide)", 4, 30], pts: [[4, 46, H.village], [3, 38, 5.2]], half: 1.6, shoulder: 2, paint: Paint.Path },
  ],
};

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

/** The plaza's stone (the plaza landmark's centre), units. */
const PLAZA: { at: XZ; r: number } = { at: [10, 60], r: 8 };

export interface GenerateReport { land: number; heights: [number, number]; quays: number; pads: number; steepMoved: number }

/**
 * The world from a plan: heights, paint and zone annotations; `objects` stay where they are (R1 moves none) and stand
 * on their pads; `keep` are annotations carried over unchanged (the village's house and lot marks).
 */
export function generateWorld(objects: World["objects"], keep: readonly MapAnnotation[], plan: Plan = PLAN): { world: World; report: GenerateReport } {
  const t = createTerrain(384, 552, -192, -276);
  const { cols, rows, res } = t, n = cols * rows;
  // The land: the union of the land zones, less the water.
  const L = new Float32Array(n).fill(-1e3);
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const x = sampleX(t, i), z = sampleZ(t, k);
    let l = -1e3, wet = -1e3;
    for (const zn of plan.zones) {
      if (zn.kind === "shape") continue;
      const d = zn.shape(x, z);
      if (zn.kind === "water") wet = Math.max(wet, d); else l = Math.max(l, d);
    }
    L[k * cols + i] = Math.min(l, -wet);
  }
  const inland = contourDistance(L, cols, rows, res, 0);
  const shore: ShoreSdf = { data: inland.map(v => -v), width: cols, height: rows, scale: res, minX: t.x0 - 0.5 / res, minZ: t.z0 - 0.5 / res, sizeX: cols / res, sizeZ: rows / res };

  // The ground, zone by zone, then the ramps, then the coast.
  const member = plan.zones.map(() => new Float32Array(n));
  const painted = new Int8Array(n).fill(-1), below = new Float32Array(n);
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const p = k * cols + i, x = sampleX(t, i), z = sampleZ(t, k), d = inland[p];
    let h = plan.base, g = CONVERT.bank;
    plan.zones.forEach((zn, j) => {
      // The rim's steepness wanders along it (some faces sheer, some leaning), as a cliff does.
      const e = (typeof zn.edge === "number" ? zn.edge : zn.edge(x, z)) * (0.55 + 0.9 * fbm(x / 9, z / 9, 200 + j, 2));
      const sd = zn.shape(x, z), ledge = (zn.ledge ?? 3) * (0.6 + 0.8 * fbm(x / 11, z / 11, 300 + j, 2));
      let m = 0;
      (zn.tiers ?? [1]).forEach((share, q) => { m += share * smoothstep(-e, e, sd - q * ledge); });
      member[j][p] = m;
      if (m <= 0) return;
      if (zn.kind !== "water") h += ((typeof zn.ground === "number" ? zn.ground : zn.ground(x, z, d, h)) - h) * m;
      if (zn.coast !== undefined) g += (zn.coast - g) * m;
      if (zn.paint !== undefined && m > 0.5) { painted[p] = zn.paint; below[p] = zn.paintBelow ?? Infinity; }
    });
    for (const r of plan.ramps) {
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
    plan.zones.forEach((zn, j) => {
      if (member[j][p] < 0.5) return;
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
