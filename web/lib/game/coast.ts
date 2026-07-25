/**
 * Organic coastline v2 (David 2026-07-14: "more dramatic", "doesn't look
 * like a cove"). The island silhouette is a radial function of angle:
 *
 *   R(θ) = 52 + [ Σ aₖ·sin(kθ)  +  Σ gaussians ] × mouthMasks
 *
 * - Harmonics: big organic lobes/bays (±~4.5).
 * - Gaussians: a deliberate BAY bitten in at the wood deck's angle with
 *   two headland arms framing it — the cove now reads concave, palms on
 *   the arms, camp on the inner sand (coords solved in coast_solver.py).
 * - Mouth masks: multiplicative (1 − gaussian) pinned on the two river
 *   mouths so the waterfalls keep their exact coastline.
 *
 * coastDist(x,z) = |xz| − wobble: distance in a space where the coast is
 * a 52-circle again — every legacy threshold (sand 48.5 / sink 49.5 /
 * waterline ≈51.4) keeps working. The Ocean + ground shaders carry the
 * same math via COAST_GLSL — edit the tables here only.
 */

export const COAST_BASE = 52;
// GEO S1 (David 2026-07-25): the island grows +18% — all coast-space
// thresholds stay in the legacy 52-basis; world positions are legacy ×
// COAST_SCALE. coastDist divides back so every consumer keeps working.
export const COAST_SCALE = 61 / 52;

// [harmonic k, amplitude] — S1 character pass: amplitudes +35% so the
// bigger island reads MORE irregular, not just larger (never oval).
const HARMONICS: [number, number][] = [
  [2, 4.6],
  [3, 3.3],
  [5, 1.9],
  [8, 0.9],
];

// [center angle, sigma, amplitude] — cove bay + framing headlands, plus
// the S1 NW INLET (a narrow deep bite with a small framing headland).
const GAUSSIANS: [number, number, number][] = [
  [1.16, 0.14, -3.2],
  [0.8, 0.1, 3.4],
  [1.54, 0.1, 3.4],
  [2.35, 0.09, -4.2],
  [2.62, 0.08, 1.6],
];

// [center angle, sigma] — river mouths (east θ≈0.055, west θ≈3.093)
const MASKS: [number, number][] = [
  [0.055, 0.16],
  [3.093, 0.16],
];

/** Radial offset of the coastline at the angle of (x, z). Range ≈ ±7. */
export function coastWobble(x: number, z: number): number {
  const a = Math.atan2(z, x);
  let w = 0;
  for (let i = 0; i < HARMONICS.length; i++) {
    w += HARMONICS[i][1] * Math.sin(HARMONICS[i][0] * a);
  }
  for (let i = 0; i < GAUSSIANS.length; i++) {
    const t = (a - GAUSSIANS[i][0]) / GAUSSIANS[i][1];
    w += GAUSSIANS[i][2] * Math.exp(-t * t);
  }
  for (let i = 0; i < MASKS.length; i++) {
    const t = (a - MASKS[i][0]) / MASKS[i][1];
    w *= 1 - Math.exp(-t * t);
  }
  return w;
}

/** Distance from origin in coast-space (legacy 52-basis): the coast sits
 *  at COAST_BASE regardless of COAST_SCALE. */
export function coastDist(x: number, z: number): number {
  return Math.hypot(x, z) / COAST_SCALE - coastWobble(x, z);
}

/**
 * Beach WIDTH variation: shifts where the sand color begins, per angle —
 * wide sandy sweeps on some stretches, grassy banks that run nearly to
 * the water on others. Purely cosmetic (color bands in the ground mesh);
 * the waterline itself stays rimSink-defined.
 */
export function beachWidthShift(x: number, z: number): number {
  const a = Math.atan2(z, x);
  // S7 The Flats: the SE bulge (θ≈0.94) gets a broad tidal-sand shelf —
  // the sand line pulls ~5 legacy units inland across the walkable shelf.
  const flats = 5 * Math.exp(-(((a - 0.94) / 0.22) ** 2));
  return 1.1 * Math.sin(4 * a + 0.9) + 0.7 * Math.sin(6 * a + 2.6) + flats;
}

/**
 * Clamp a point so coastDist(point) ≤ limit, preserving its angle.
 * Radial scaling keeps θ (and therefore the wobble) unchanged, so one
 * pass is exact. Returns [x, z].
 */
// GEO S5 (2026-07-25): Isla Chica — the boat islet is its own walkable
// disc in world space, far outside the main coast field. Keep in sync
// with IslaChica.tsx (ISLET_CENTER / ISLET_WALK_R re-export these).
export const ISLET = { x: -24, z: 72, walkR: 5.6 };

export function clampToCoast(x: number, z: number, limit: number): [number, number] {
  // Islet halo: points near Isla Chica clamp to the islet rim instead of
  // being dragged back to the main coast. The halo (+4) can never reach
  // the mainland — the water gap is wider than that.
  const dix = x - ISLET.x, diz = z - ISLET.z;
  const di = Math.hypot(dix, diz);
  if (di < ISLET.walkR + 4) {
    if (di <= ISLET.walkR) return [x, z];
    const fi = ISLET.walkR / di;
    return [ISLET.x + dix * fi, ISLET.z + diz * fi];
  }
  const d = Math.hypot(x, z);
  if (d < 1e-6) return [x, z];
  const max = (limit + coastWobble(x, z)) * COAST_SCALE;
  if (d <= max) return [x, z];
  const f = max / d;
  return [x * f, z * f];
}

// Rim-sink profile (mirrors the ground mesh in GameWorld's Terrain —
// keep in sync): past SINK_START the beach dives below the ocean.
const SINK_START = 49.5;
const SINK_END = 56;
const SINK_DEPTH = 2.4;

/** How far the beach has sunk at coast-distance e (≥ 0). */
export function rimSink(e: number): number {
  if (e <= SINK_START) return 0;
  const t = Math.min((e - SINK_START) / (SINK_END - SINK_START), 1);
  return t * t * (3 - 2 * t) * SINK_DEPTH;
}

/** The same wobble as a GLSL function (vec2 p in world XZ). Wobble is in
 *  the LEGACY basis — shaders convert world radius via COAST_SCALE. */
export const COAST_GLSL = `
const float COAST_SCALE = ${COAST_SCALE.toFixed(5)};
float coastWobble(vec2 p) {
  float a = atan(p.y, p.x);
  float w = ${HARMONICS.map(([k, amp]) => `${amp.toFixed(2)} * sin(${k.toFixed(1)} * a)`).join(" + ")};
  ${GAUSSIANS.map(([c, s, amp], i) => `float g${i} = (a - ${c.toFixed(3)}) / ${s.toFixed(3)};
  w += ${amp.toFixed(2)} * exp(-g${i} * g${i});`).join("\n  ")}
  ${MASKS.map(([c, s], i) => `float m${i} = (a - ${c.toFixed(3)}) / ${s.toFixed(3)};
  w *= 1.0 - exp(-m${i} * m${i});`).join("\n  ")}
  return w;
}
`;
