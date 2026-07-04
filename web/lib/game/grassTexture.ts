/**
 * Procedural grass detail texture (G5 visual polish, 2026-06-01).
 *
 * Generates a 256x256 tileable noise pattern as a Three.js DataTexture
 * to overlay on the terrain mesh. Multiplies with the existing vertex
 * colors to add fine-grain "grass blade" detail without external assets.
 *
 * Deterministic — same seed every call so we don't recompute on hot
 * reload + tabs see the same look.
 */

import * as THREE from "three";

const SIZE = 256;
const SEED = 1138;

function rand(state: { v: number }): number {
  // xorshift32 — deterministic, fast.
  state.v ^= state.v << 13;
  state.v ^= state.v >>> 17;
  state.v ^= state.v << 5;
  return ((state.v >>> 0) / 0xffffffff);
}

let cached: THREE.DataTexture | null = null;

/**
 * Returns a tileable grass-detail texture. Values are pre-multiplied
 * (white-ish) so they multiply cleanly with vertex colors.
 */
export function getGrassTexture(): THREE.DataTexture {
  if (cached) return cached;

  const data = new Uint8Array(SIZE * SIZE * 4);
  const state = { v: SEED };

  // ACNH triangle quilt (cozy push V4): a grid of TRI-px square cells, each
  // split by a diagonal into two triangles; the diagonal flips on a
  // checkerboard so the quilt tessellates the way New Horizons' ground does.
  // Each triangle takes one of three close brightness tones from a
  // deterministic hash, plus a whisper of per-pixel noise against banding.
  // Values stay pre-multiplied (~0.86-1.0) so they modulate the vertex-color
  // greens rather than replace them.
  const TRI = 16; // px per cell → 16 cells per tile ≈ 0.5u triangles in-world
  const TONES = [0.875, 0.93, 1.0];

  const cellHash = (cx: number, cy: number, half: number): number => {
    let h = (cx * 374761393 + cy * 668265263 + half * 97) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return (h ^ (h >>> 16)) >>> 0;
  };

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;

      const cx = Math.floor(x / TRI);
      const cy = Math.floor(y / TRI);
      const lx = x % TRI;
      const ly = y % TRI;
      // Checkerboard flips the split diagonal so triangles tessellate.
      const flip = (cx + cy) % 2 === 0;
      const half = (flip ? lx + ly < TRI : lx >= ly) ? 0 : 1;

      const tone = TONES[cellHash(cx, cy, half) % 3];
      const jitter = (rand(state) - 0.5) * 0.03;
      const v = tone + jitter;

      // Green-biased premultiply: the quilt reads as grass-tone variation,
      // not desaturation.
      data[idx] = Math.max(0, Math.min(255, Math.round(v * 232)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(v * 250)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(v * 218)));
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Tile ~10x across the 82-unit terrain — enough density to feel like
  // grass blades, not so much it shimmers.
  tex.repeat.set(10, 10);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  cached = tex;
  return tex;
}
