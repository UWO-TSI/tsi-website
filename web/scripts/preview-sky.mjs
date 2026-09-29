#!/usr/bin/env node
/**
 * preview-sky — render the sky shader on the CPU, as a contact sheet.
 *
 *   node scripts/preview-sky.mjs [--out <png>]
 *
 * WHY THIS EXISTS. There is no working WebGL in this environment (browse
 * cannot get a context, headless or headed), so the alternative to this is
 * shipping a sky nobody has looked at. This evaluates the SAME maths as
 * `lib/game/skyShader.ts`'s fragment shader, per pixel, through the same camera
 * the game uses, and writes a PNG.
 *
 * It is not a screenshot. It has no tone mapping, no post grade, and no sun or
 * moon sprite. What it does prove is the part most likely to be wrong: the
 * projection, the layer weights, the gradient, and whether a weather state
 * actually looks like that weather.
 *
 * THE CAMERA IS THE REAL ONE. `CameraControls` clamps maxPolarAngle to PI/2, so
 * the view axis is horizontal at worst, and the FOV is 48 vertical — which puts
 * the top of frame 24 degrees above the horizon and nothing above that ever on
 * screen. Rendering a full dome would be a lie about what the player sees, so
 * each tile is that band and only that band.
 */

import path from "path";
import url from "url";
import sharp from "sharp";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const LAYERS = path.join(WEB, "public/assets/sky/layers");

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const OUT = arg("out", path.join(WEB, "public/assets/sky/layers/preview.png"));

const TILE_W = 480;
const TILE_H = 200;
const FOV = (48 * Math.PI) / 180;

// ── Texture sampling ─────────────────────────────────────────────

async function loadPack(file) {
  const img = sharp(path.join(LAYERS, file));
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
}

/** Bilinear sample of one channel. `repeat` picks wrap vs clamp. */
function sample(tex, u, v, c) {
  const { data, w, h, ch } = tex;
  let x = u * w - 0.5;
  let y = v * h - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  // MIRRORED repeat, matching MirroredRepeatWrapping on the GPU.
  const wrap = (i, n) => {
    const m = ((i % (2 * n)) + 2 * n) % (2 * n);
    return m < n ? m : 2 * n - 1 - m;
  };
  const at = (ix, iy) => data[(wrap(iy, h) * w + wrap(ix, w)) * ch + c] / 255;
  return (
    at(x0, y0) * (1 - fx) * (1 - fy) +
    at(x0 + 1, y0) * fx * (1 - fy) +
    at(x0, y0 + 1) * (1 - fx) * fy +
    at(x0 + 1, y0 + 1) * fx * fy
  );
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

// ── The fragment shader, in JS ───────────────────────────────────
// Kept line-for-line comparable with FRAG in skyShader.ts. If one changes the
// other has to, and a preview that has quietly drifted from the shader is worse
// than no preview at all.

function shadePixel(dir, U, A, B, C) {
  const el = Math.max(dir[1], 0);
  // See skyShader.ts: el never exceeds ~0.42 through the real camera, so every
  // height-shaped term works in normalised space or it lands off screen.
  const elN = clamp(el / 0.42, 0, 1);

  const sheetUv = (scale, dx, dy) => [
    (dir[0] / (el + 0.28)) * scale + dx,
    (dir[2] / (el + 0.28)) * scale + dy,
  ];

  const sky = [0, 0, 0];
  const p = Math.pow(elN, 0.7);
  for (let i = 0; i < 3; i++) sky[i] = mix(U.horizon[i], U.zenith[i], p);

  const fade = smoothstep(0, 0.16, elN);
  const t = U.time * U.wind;
  const s = U.cloudScale;

  const uvP = sheetUv(s, t * 0.01, t * 0.004);
  const uvC = sheetUv(s * 0.78, t * 0.013, t * 0.006);
  const uvO = sheetUv(s * 0.62, t * 0.008, t * 0.003);
  const uvS = sheetUv(s * 0.55, t * 0.016, t * 0.009);
  const uvN = sheetUv(s * 1.9, t * 0.006, t * 0.002);

  const puffyCover = sample(A, uvP[0], uvP[1], 0);
  const puffyShade = sample(A, uvP[0], uvP[1], 1);
  const chunkyCover = sample(A, uvC[0], uvC[1], 2);
  const chunkyShade = sample(B, uvC[0], uvC[1], 0);
  const overcast = sample(B, uvO[0], uvO[1], 1);
  const storm = sample(B, uvS[0], uvS[1], 2);
  const noise = sample(C, uvN[0], uvN[1], 0);
  const breakUp = mix(1, 0.35 + noise * 0.9, 0.55);

  const band = smoothstep(U.bandHeight - 0.75, U.bandHeight + 0.75, elN);
  const border = mix(1, band, clamp(U.bandEffect, 0, 1));

  const aPuffy = puffyCover * U.puffy * border * breakUp;
  const aChunky = chunkyCover * U.chunky * border * breakUp;
  const aOver = U.overcast * border * breakUp;
  const aStorm = U.storm * breakUp * smoothstep(0, mix(0.9, 0.15, U.stormReach), elN);

  // COZY's own composite: chained lerps from 1.0, density is the summed alpha.
  let shade = 1;
  shade = mix(shade, puffyShade, aPuffy);
  shade = mix(shade, chunkyShade, aChunky);
  shade = mix(shade, overcast, aOver);
  shade = mix(shade, storm, aStorm);
  shade = clamp(shade, 0, 1);

  const density = clamp(aPuffy + aChunky + aOver + aStorm, 0, 1) * fade;

  const cloud = [0, 0, 0];
  for (let i = 0; i < 3; i++) cloud[i] = mix(U.cloudDark[i], U.cloudLit[i], shade);

  if (U.night > 0.001) {
    const su = sheetUv(s * 0.9, 0, 0);
    const stars = sample(C, su[0], su[1], 1);
    const g = [0.85, 0.9, 1.0];
    for (let i = 0; i < 3; i++) sky[i] += g[i] * Math.pow(stars, 2.2) * U.night * fade * 2.2;
  }

  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = mix(sky[i], cloud[i], density) * U.value;
  return out;
}

// ── Render ───────────────────────────────────────────────────────

function renderTile(U, A, B, C) {
  const buf = Buffer.alloc(TILE_W * TILE_H * 3);
  const aspect = TILE_W / TILE_H;
  const th = Math.tan(FOV / 2);
  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      // Camera looks along -Z, horizontally. Top of frame is +24 degrees, which
      // is the most sky the game can ever show.
      const ndcX = (x / TILE_W) * 2 - 1;
      const ndcY = 1 - (y / TILE_H) * 2;
      const dx = ndcX * th * aspect;
      const dy = ndcY * th;
      const len = Math.hypot(dx, dy, 1);
      const dir = [dx / len, dy / len, -1 / len];
      const c = shadePixel(dir, U, A, B, C);
      const i = (y * TILE_W + x) * 3;
      // Approximate sRGB encode, so the preview is not gamma-dark.
      for (let k = 0; k < 3; k++) buf[i + k] = Math.round(clamp(Math.pow(clamp(c[k], 0, 1), 1 / 2.2), 0, 1) * 255);
    }
  }
  return buf;
}

/** Time of day, straight off TOD_KEYS in GameWorld.tsx. */
const TIMES = {
  morning: { zenith: 0x63c2f7, horizon: 0xffb878, lit: 0xffe7c4, dark: 0xc0b4c8, night: 0, value: 1 },
  noon: { zenith: 0x4fb6f5, horizon: 0xa9dcf2, lit: 0xfff7e4, dark: 0xb9cbdc, night: 0, value: 1 },
  evening: { zenith: 0x7fb4d8, horizon: 0xff9966, lit: 0xffa35c, dark: 0x8d6f80, night: 0, value: 1 },
  night: { zenith: 0x1a1a40, horizon: 0x334466, lit: 0x50607f, dark: 0x232a44, night: 1, value: 1 },
};

/** Weather, straight off WEATHER_PROFILES in weatherSystem.ts. */
const STATES = {
  clear: { puffy: 0.15, chunky: 0, overcast: 0, storm: 0, stormReach: 1, bandHeight: 0.5, bandEffect: 1, value: 1 },
  fair: { puffy: 0.6, chunky: 0, overcast: 0, storm: 0, stormReach: 1, bandHeight: 0.5, bandEffect: 1, value: 1 },
  "partly-cloudy": { puffy: 1, chunky: 0.4, overcast: 0, storm: 0, stormReach: 1, bandHeight: 0.45, bandEffect: 1, value: 1 },
  "mostly-cloudy": { puffy: 1.3, chunky: 0.9, overcast: 0.5, storm: 0, stormReach: 1, bandHeight: 0.3, bandEffect: 0.6, value: 0.92 },
  overcast: { puffy: 0.6, chunky: 1.2, overcast: 0.85, storm: 0.3, stormReach: 0.8, bandHeight: 0.1, bandEffect: 0.2, value: 0.85 },
  rain: { puffy: 0, chunky: 0.8, overcast: 0.9, storm: 1.0, stormReach: 1, bandHeight: 0, bandEffect: 0, value: 0.72 },
  storm: { puffy: 0, chunky: 0.6, overcast: 1.0, storm: 1.3, stormReach: 1, bandHeight: 0, bandEffect: 0, value: 0.6 },
};

const A = await loadPack("sky-a.webp");
const B = await loadPack("sky-b.webp");
const C = await loadPack("sky-c.webp");
console.log(`packs: ${A.w}² x${A.ch}ch / ${B.w}² x${B.ch}ch`);

const rows = [];
const labels = [];
for (const [tname, T] of Object.entries(TIMES)) {
  for (const [sname, S] of Object.entries(STATES)) {
    // Night only needs one weather; the rest of the grid is repetition.
    if (tname === "night" && !["clear", "overcast", "storm"].includes(sname)) continue;
    if (tname === "morning" && ["mostly-cloudy", "storm"].includes(sname)) continue;
    if (tname === "evening" && ["mostly-cloudy", "rain"].includes(sname)) continue;
    const U = {
      zenith: hex(T.zenith),
      horizon: hex(T.horizon),
      cloudLit: hex(T.lit),
      cloudDark: hex(T.dark),
      night: T.night,
      time: 40,
      wind: 0.84,
      cloudScale: 0.5,
      value: T.value * S.value,
      ...S,
    };
    rows.push(renderTile(U, A, B, C));
    labels.push(`${tname}/${sname}`);
  }
}

const COLS = 4;
const R = Math.ceil(rows.length / COLS);
const sheet = Buffer.alloc(TILE_W * COLS * TILE_H * R * 3, 20);
for (let i = 0; i < rows.length; i++) {
  const cx = (i % COLS) * TILE_W;
  const cy = Math.floor(i / COLS) * TILE_H;
  for (let y = 0; y < TILE_H; y++) {
    rows[i].copy(sheet, ((cy + y) * TILE_W * COLS + cx) * 3, y * TILE_W * 3, (y + 1) * TILE_W * 3);
  }
}

await sharp(sheet, { raw: { width: TILE_W * COLS, height: TILE_H * R, channels: 3 } })
  .png()
  .toFile(OUT);

console.log(`\n${rows.length} tiles, ${COLS}x${R}:`);
labels.forEach((l, i) => process.stdout.write(`  ${l.padEnd(24)}${(i + 1) % COLS === 0 ? "\n" : ""}`));
console.log(`\n-> ${path.relative(WEB, OUT)}`);
