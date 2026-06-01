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

export const ISLAND_RADIUS = 40;

// Noise tuning — sprint A1 target: max ~0.6 displacement
// fbm returns ~[0, 1]. NOISE_AMPLITUDE caps the height accordingly.
const NOISE_FREQ = 0.06;
const NOISE_AMPLITUDE = 0.6;

// Building flatten zones. Each entry: [centerX, centerZ, radius].
// Inside radius: terrain returns that building's "footprint height"
// (the noise height sampled at the center). Smoothly blends back to
// noise out to radius * 1.5. Keep in sync with BUILDINGS in GameWorld.tsx.
export const BUILDING_FOOTPRINTS: Array<{ x: number; z: number; radius: number }> = [
  { x: 0, z: -4, radius: 4.5 },   // HQ (size 6x5)
  { x: -14, z: 8, radius: 3.2 },  // Shop (size 4x4)
  { x: 0, z: 22, radius: 4.0 },   // Oracle Temple (size 5x5)
  { x: 14, z: 10, radius: 2.8 },  // House (size 3.5x3.5)
  { x: 10, z: 8, radius: 1.4 },   // Bounty board
  { x: -10, z: -10, radius: 1.4 }, // Job board
  { x: 10, z: -10, radius: 1.4 }, // Leaderboard
];

// Path corridors — keep paths flat (height = 0). Each entry: axis-aligned rect.
// [axis, axisPos, halfWidth, otherMin, otherMax, falloff]
// axis "z" = path runs along Z, so x is the cross-axis at axisPos.
type PathCorridor = { axis: "x" | "z"; pos: number; halfWidth: number; from: number; to: number; falloff: number };
const PATH_CORRIDORS: PathCorridor[] = [
  { axis: "x", pos: 0, halfWidth: 1.75, from: -23, to: 17, falloff: 1.5 },   // N-S spine
  { axis: "z", pos: 8, halfWidth: 1.75, from: -16, to: 16, falloff: 1.5 },   // E-W at z=8
  { axis: "z", pos: -10, halfWidth: 1.75, from: -12, to: 12, falloff: 1.5 }, // E-W at z=-10
];

// ─── Internal: raw noise terrain (no flattening) ─────────────────

function rawNoiseHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);
  if (dist > ISLAND_RADIUS) return 0;

  let h = fbm(x * NOISE_FREQ, z * NOISE_FREQ, 4) * NOISE_AMPLITUDE;

  // Island edge falloff to keep the perimeter at y=0
  if (dist > 32) {
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
  return a + (b - a) * fz;
}
