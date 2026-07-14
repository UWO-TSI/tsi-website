/**
 * Terrain height generation for the AC-style game world.
 * Uses value noise with FBM for subtle rolling hills.
 *
 * Sprint A1 retune (2026-05-21): max y-displacement ~0.6 units per
 * sprint-2026-05-game-look-feel.md §A1. Previous version peaked at
 * ~3.5 (oracle hill) which felt mountainous, not cozy. Buildings now
 * get an explicit flatten zone so they sit flush on slabs and don't
 * tilt or float as noise rolls under them.
 *
 * Spec: ux-game-world-v2.md Section 4.1, sprint-2026-05-game-look-feel.md §A1
 */

// ─── Value Noise ─────────────────────────────────────────────────

function fract(x: number): number {
  return x - Math.floor(x);
}

function hash2D(ix: number, iy: number): number {
  const dot = ix * 127.1 + iy * 311.7;
  return fract(Math.sin(dot) * 43758.5453);
}

export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm(x: number, y: number, octaves: number = 4): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += valueNoise(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

// ─── Constants ───────────────────────────────────────────────────

export const ISLAND_RADIUS = 52;

// Noise tuning — sprint A1 target: max ~0.6 displacement
// fbm returns ~[0, 1]. NOISE_AMPLITUDE caps the height accordingly.
const NOISE_FREQ = 0.06;
const NOISE_AMPLITUDE = 0.6;

// Building flatten zones. Each entry: [centerX, centerZ, radius].
// Inside radius: terrain returns that building's "footprint height"
// (the noise height sampled at the center). Smoothly blends back to
// noise out to radius * 1.5. Keep in sync with BUILDINGS in GameWorld.tsx.
// ACNH revamp 2026-07: model origin sits at the door plane and the body
// extends behind it (+z after the 180° world rotation), so flatten centers
// are pushed ~1.5-2u toward the body, radii sized to the visual footprints.
// Art pass 2026-07-07 (island respace): buildings spread into the ring,
// island radius 40->52.
export const BUILDING_FOOTPRINTS: Array<{ x: number; z: number; radius: number }> = [
  { x: 0, z: -2.3, radius: 4.2 },   // HQ office
  { x: -24, z: 13.8, radius: 4.2 }, // Shop market
  { x: 0, z: 31.8, radius: 4.5 },   // Oracle museum
  { x: 24, z: 15.1, radius: 3.2 },  // House chalet
  { x: 14, z: 9, radius: 1.4 },     // Bounty board
  { x: -15, z: -13, radius: 1.4 },  // Job board
  { x: 15, z: -13, radius: 1.4 },   // Leaderboard
  { x: -31.5, z: -18, radius: 3 },  // ambient house (red chalet)
  { x: 31.5, z: -19, radius: 3 },   // ambient house (yellow chalet)
];

// ─── River valley (ACNH revamp 2026-07) ─────────────────────────
// River.tsx draws the water plane at y=-0.04 and the bed at -0.12. The A3
// "terrain valley dip" follow-up was never built, so the noise terrain
// (0..0.6) buried the river — it only ever peeked through via the bed's
// polygonOffset at lucky angles. Carve a real valley along the spline.
// Polyline mirrors RIVER_CONTROL_POINTS in River.tsx (keep in sync);
// two Chaikin passes approximate the Catmull-Rom bend closely enough
// for a distance field.
const RIVER_BASE: [number, number][] = [
  [-52, 2], [-30, 5], [-12, 5], [-3, 1], [5, 4], [16, 2], [30, 4], [52, 3],
];
const RIVER_POLYLINE: [number, number][] = (() => {
  let pts = RIVER_BASE;
  for (let pass = 0; pass < 2; pass++) {
    const out: [number, number][] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25]);
      out.push([ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
})();
const RIVER_DEPTH = -0.35; // valley floor, below the -0.12 riverbed plane
const RIVER_HALF = 2.2;    // full-depth half-width (water is 1.9 half-wide)
const RIVER_BLEND = 1.3;   // bank blend distance beyond RIVER_HALF

function distToRiver(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < RIVER_POLYLINE.length - 1; i++) {
    const [ax, az] = RIVER_POLYLINE[i];
    const [bx, bz] = RIVER_POLYLINE[i + 1];
    const abx = bx - ax, abz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz)));
    const dx = x - (ax + abx * t), dz = z - (az + abz * t);
    const d2 = dx * dx + dz * dz;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
}

/** 1 inside the channel, smoothstep → 0 across the banks. */
function riverInfluence(x: number, z: number): number {
  const d = distToRiver(x, z);
  if (d >= RIVER_HALF + RIVER_BLEND) return 0;
  if (d <= RIVER_HALF) return 1;
  const t = 1 - (d - RIVER_HALF) / RIVER_BLEND;
  return t * t * (3 - 2 * t);
}

// Path corridors — keep paths flat (height = 0). Each entry: axis-aligned rect.
// [axis, axisPos, halfWidth, otherMin, otherMax, falloff]
// axis "z" = path runs along Z, so x is the cross-axis at axisPos.
type PathCorridor = { axis: "x" | "z"; pos: number; halfWidth: number; from: number; to: number; falloff: number };
const PATH_CORRIDORS: PathCorridor[] = [
  { axis: "x", pos: 0, halfWidth: 1.75, from: -24, to: 27, falloff: 1.5 },   // N-S spine
  { axis: "z", pos: 10, halfWidth: 1.75, from: -26, to: 26, falloff: 1.5 },  // E-W at z=10
  { axis: "z", pos: -13, halfWidth: 1.75, from: -17, to: 17, falloff: 1.5 }, // E-W at z=-13
  // Beach Cove spur (2026-07-14): sand path SE off the spine + wood deck.
  { axis: "z", pos: 23.75, halfWidth: 1.75, from: 1, to: 20, falloff: 1.5 },
  { axis: "x", pos: 18.25, halfWidth: 1.75, from: 25.5, to: 40, falloff: 1.5 },
  { axis: "x", pos: 18.25, halfWidth: 2.65, from: 39.9, to: 44.2, falloff: 1.5 },
];

// ─── Internal: raw noise terrain (no flattening) ─────────────────

function rawNoiseHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);
  if (dist > ISLAND_RADIUS) return 0;

  let h = fbm(x * NOISE_FREQ, z * NOISE_FREQ, 4) * NOISE_AMPLITUDE;

  // Organic terrain (David 2026-07-14): a broad low-frequency swell adds
  // rolling meadows to the outskirts. Damped near the plaza so the
  // village center stays calm; paths/buildings flatten through it as
  // usual (falloff walls stay gentle).
  const villageCalm = Math.min(Math.max((Math.hypot(x, z + 13) - 12) / 10, 0), 1);
  h += fbm(x * 0.021 + 7.3, z * 0.021 - 3.1, 2) * 0.5 * villageCalm;

  // Island edge falloff to keep the perimeter at y=0
  if (dist > ISLAND_RADIUS - 8) {
    h *= Math.max(0, (ISLAND_RADIUS - dist) / 8);
  }

  return Math.max(h, 0);
}

// ─── Public: terrain sampling ────────────────────────────────────

/**
 * Returns the terrain Y-height at world position (x, z).
 * Used by GameWorld (terrain mesh, object placement) and PlayerAvatar (ground follow).
 *
 * Buildings get flat footprints — see BUILDING_FOOTPRINTS. Paths get
 * flattened to y=0 with a falloff so the dirt-path quads sit flush.
 */
export function getTerrainHeight(x: number, z: number): number {
  // 0. River valley — carves through everything (paths cross via the
  // bridge; building footprints don't reach the channel core).
  const ri = riverInfluence(x, z);
  if (ri >= 1) return RIVER_DEPTH;
  const base = baseTerrainHeight(x, z);
  return ri > 0 ? base * (1 - ri) + RIVER_DEPTH * ri : base;
}

function baseTerrainHeight(x: number, z: number): number {
  // 1. Building footprint flattening — strongest claim
  for (const b of BUILDING_FOOTPRINTS) {
    const dx = x - b.x;
    const dz = z - b.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < b.radius) {
      // Solid flat slab at the building's reference height
      return rawNoiseHeight(b.x, b.z);
    }
    if (d < b.radius * 1.5) {
      // Blend zone — smooth ramp from building height back to noise
      const t = (d - b.radius) / (b.radius * 0.5);
      const smooth = t * t * (3 - 2 * t); // smoothstep
      const buildingH = rawNoiseHeight(b.x, b.z);
      return buildingH + (rawNoiseHeight(x, z) - buildingH) * smooth;
    }
  }

  // 2. Path corridor flattening
  let pathInfluence = 0;
  for (const p of PATH_CORRIDORS) {
    const cross = p.axis === "x" ? x - p.pos : z - p.pos;
    const along = p.axis === "x" ? z : x;
    if (along < p.from || along > p.to) continue;
    const absCross = Math.abs(cross);
    if (absCross < p.halfWidth) {
      pathInfluence = Math.max(pathInfluence, 1);
    } else if (absCross < p.halfWidth + p.falloff) {
      const t = 1 - (absCross - p.halfWidth) / p.falloff;
      pathInfluence = Math.max(pathInfluence, t * t * (3 - 2 * t));
    }
  }

  const noiseH = rawNoiseHeight(x, z);
  return noiseH * (1 - pathInfluence);
}

/**
 * Convenience alias matching A1 spec naming. Returns the same value as
 * getTerrainHeight — exists so future code can use the spec-canonical name.
 */
export function sampleTerrainHeight(x: number, z: number): number {
  return getTerrainHeight(x, z);
}

// ─── Lookup grid (perf — 2026-06-01) ─────────────────────────────
//
// getTerrainHeight runs FBM (4 octaves × valueNoise) on every call. At
// 60fps with player + ~10 ghosts + NPCs + filler NPCs all sampling per
// frame for ground-follow, that's ~960 FBM invocations/sec. Each FBM is
// 16 noise samples → ~15K sin/floor calls/sec just for ground follow.
// Tolerable on desktop, hot on 8GB M1 / Chromebooks.
//
// Bake a 257×257 grid covering [-ISLAND_RADIUS, ISLAND_RADIUS] once at
// module load, then bilinear-sample at runtime. Reduces per-call cost to
// 4 array reads + 4 lerps. ~50x cheaper.
//
// Heights of buildings + path flattening are already in getTerrainHeight,
// so we bake the FINAL height, not raw noise. That means any future edit
// to BUILDING_FOOTPRINTS / PATH_CORRIDORS requires rebuilding the grid —
// but those are static module-level constants, so doing it at module load
// is fine and the grid never goes stale at runtime.

const GRID_SIZE = 257; // 257 so we have 256 cells with edges at ±ISLAND_RADIUS
const CELL_SIZE = (ISLAND_RADIUS * 2) / (GRID_SIZE - 1);

// Filled lazily on first sample. Avoids paying the bake cost during SSR.
let TERRAIN_GRID: Float32Array | null = null;

function bakeGrid(): Float32Array {
  const grid = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    const z = -ISLAND_RADIUS + i * CELL_SIZE;
    for (let j = 0; j < GRID_SIZE; j++) {
      const x = -ISLAND_RADIUS + j * CELL_SIZE;
      grid[i * GRID_SIZE + j] = getTerrainHeight(x, z);
    }
  }
  return grid;
}

/**
 * Cheap O(1) terrain height sample via bilinear interpolation over a
 * pre-baked 257×257 grid. ~50x faster than getTerrainHeight() for
 * per-frame ground-follow callers (player avatar, ghosts, NPCs).
 *
 * Use this in `useFrame` loops. Use getTerrainHeight() for one-shot
 * placement (building y, slab patches, prop spawn) — slightly more
 * accurate near grid boundaries.
 */
export function sampleTerrainHeightFast(x: number, z: number): number {
  // Out-of-bounds clamp to 0 matches getTerrainHeight's island-edge
  // behavior (perimeter falls off to y=0 at ISLAND_RADIUS).
  if (Math.abs(x) > ISLAND_RADIUS || Math.abs(z) > ISLAND_RADIUS) return 0;

  if (!TERRAIN_GRID) {
    TERRAIN_GRID = bakeGrid();
  }
  const grid = TERRAIN_GRID;

  // Map world (x, z) into grid space [0, GRID_SIZE - 1].
  const gx = (x + ISLAND_RADIUS) / CELL_SIZE;
  const gz = (z + ISLAND_RADIUS) / CELL_SIZE;

  const i0 = Math.floor(gz);
  const j0 = Math.floor(gx);
  const i1 = Math.min(i0 + 1, GRID_SIZE - 1);
  const j1 = Math.min(j0 + 1, GRID_SIZE - 1);
  const fz = gz - i0;
  const fx = gx - j0;

  const h00 = grid[i0 * GRID_SIZE + j0];
  const h01 = grid[i0 * GRID_SIZE + j1];
  const h10 = grid[i1 * GRID_SIZE + j0];
  const h11 = grid[i1 * GRID_SIZE + j1];

  const a = h00 + (h01 - h00) * fx;
  const b = h10 + (h11 - h10) * fx;
  const h = a + (b - a) * fz;

  // Bridge deck override for walkers: the N-S path crosses the carved
  // river valley on the wooden bridge (deck top ≈ 0.1). Without this,
  // ground-follow dips the player under the deck mid-crossing. Cheap
  // |x| guard keeps riverInfluence out of the common case.
  if (x > -1.5 && x < 1.5 && riverInfluence(x, z) > 0 && h < 0.12) return 0.12;
  return h;
}
