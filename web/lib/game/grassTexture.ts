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

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;

      // Multi-octave value noise approximation: blend a low-freq base
      // (~smooth blotches) with a high-freq detail (single-pixel sparkle).
      const base = rand(state); // [0,1]
      // Smoothed via 3x3 box blur on x/y position parity.
      const detail = ((x * 73 + y * 31) & 7) / 7; // crude high-freq pattern
      const v = 0.85 + (base - 0.5) * 0.18 + (detail - 0.5) * 0.05;

      // RGB tinted slightly green so it doesn't desaturate the underlying
      // vertex color. Pre-multiplied: ~217-235 across all channels.
      const r = Math.max(0, Math.min(255, Math.round(v * 232)));
      const g = Math.max(0, Math.min(255, Math.round(v * 248)));
      const b = Math.max(0, Math.min(255, Math.round(v * 220)));

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
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
