/**
 * Terrain height generation for the AC-style game world.
 * Uses value noise with FBM for gentle rolling hills.
 * Spec: ux-game-world-v2.md Section 4.1
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

// ─── Terrain Height ──────────────────────────────────────────────

/**
 * Returns the terrain Y-height at world position (x, z).
 * Used by GameWorld (terrain mesh, object placement) and PlayerAvatar (ground follow).
 */
export function getTerrainHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);
  if (dist > ISLAND_RADIUS) return 0;

  // Base rolling hills from FBM noise
  let h = fbm(x * 0.06, z * 0.06, 4) * 2.2;

  // Oracle hill: elevated area around z=22 (v2 spec: 3–4 units)
  const oracleDist = Math.sqrt(x * x + (z - 22) * (z - 22));
  const oracleInfluence = oracleDist < 12 ? 1 - oracleDist / 12 : 0;
  if (oracleInfluence > 0) {
    h += oracleInfluence * oracleInfluence * 3.5;
  }

  // River valley at z≈3: dip terrain
  const riverProx = Math.abs(z - 3);
  if (riverProx < 5) {
    const t = 1 - riverProx / 5;
    h *= 1 - t * 0.9;
    h -= t * t * 0.3;
  }

  // Flatten along main N-S path (x≈0) — weakened near Oracle hill
  const nsFlat = Math.max(0, 1 - Math.abs(x) / 3);
  h *= 1 - nsFlat * 0.92 * (1 - oracleInfluence);

  // Flatten along E-W path at z≈8 (Shop → Bounty)
  const ew1 = Math.max(0, 1 - Math.abs(z - 8) / 2.5);
  h *= 1 - ew1 * 0.85;

  // Flatten along E-W path at z≈-10 (Jobs → Leaderboard)
  const ew2 = Math.max(0, 1 - Math.abs(z + 10) / 2.5);
  h *= 1 - ew2 * 0.85;

  // Island edge falloff
  if (dist > 32) {
    h *= Math.max(0, (ISLAND_RADIUS - dist) / 8);
  }

  return Math.max(h, 0);
}
