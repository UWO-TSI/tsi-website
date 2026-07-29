#!/usr/bin/env node
/**
 * preview-variants — render all eight cloud variants on the CPU.
 *
 * There is no working WebGL here, so seven of the eight variants in
 * skyVariants.ts were written without ever being rendered. This runs each of
 * them through the same camera the game uses so they can be judged instead of
 * assumed. Same limitation as preview-sky.mjs: no tone mapping, no post grade,
 * no sun sprite. It shows the cloud maths and nothing else.
 */
import path from "path";
import url from "url";
import sharp from "sharp";

const WEB = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const L = path.join(WEB, "public/assets/sky/layers");
const W = 460, H = 190, FOV = (48 * Math.PI) / 180;

const load = async (k) => {
  const { data, info } = await sharp(path.join(L, `${k}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, ch: info.channels };
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

function samp(tex, u, v, c) {
  const { data, w, h, ch } = tex;
  const wrap = (i, n) => { const m = ((i % (2 * n)) + 2 * n) % (2 * n); return m < n ? m : 2 * n - 1 - m; };
  let x = u * w - 0.5, y = v * h - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const at = (ix, iy) => data[(wrap(iy, h) * w + wrap(ix, w)) * ch + c] / 255;
  return at(x0,y0)*(1-fx)*(1-fy) + at(x0+1,y0)*fx*(1-fy) + at(x0,y0+1)*(1-fx)*fy + at(x0+1,y0+1)*fx*fy;
}

// COZY's voronoi, same as the GLSL.
function vhash(px, py) {
  const a = px * 127.1 + py * 311.7, b = px * 269.5 + py * 183.3;
  return [fract(Math.sin(a) * 43758.5453), fract(Math.sin(b) * 43758.5453)];
}
function voronoi(vx, vy, time) {
  const nx = Math.floor(vx), ny = Math.floor(vy), fx = vx - nx, fy = vy - ny;
  let F1 = 8;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const o = vhash(nx + i, ny + j);
    const ox = Math.sin(time + o[0] * 6.2831) * 0.5 + 0.5;
    const oy = Math.sin(time + o[1] * 6.2831) * 0.5 + 0.5;
    const rx = fx - i - ox, ry = fy - j - oy;
    const d = 0.5 * (rx * rx + ry * ry);
    if (d < F1) F1 = d;
  }
  return F1;
}
const vfbm = (x, y, t) => voronoi(x * 1, y * 1, t) * 0.65 + voronoi(x * 2.17 + 4.3, y * 2.17 + 4.3, t * 1.31) * 0.35;

const VARIANTS = {
  luxury: (T, uv, C, S, U) => {
    const p = uv(1.0, 0.010, 0.004), m = uv(0.78, 0.013, 0.006), o = uv(0.62, 0.008, 0.003), n = uv(0.55, 0.016, 0.009);
    const vr = samp(T.luxuryVariation, ...uv(4.0, 0.02, 0.01), 0);
    const v = mix(1, 0.4 + vr * 1.1, 0.5);
    const aP = samp(T.partlyCloudy, ...p, 3) * C[0] * S.band * v;
    const aM = samp(T.mostlyCloudy, ...m, 3) * C[1] * S.band * v;
    const aO = C[2] * S.band * v;
    const aN = samp(T.midNimbus, ...n, 3) * C[3] * v * S.storm;
    let sh = 1;
    sh = mix(sh, samp(T.partlyCloudy, ...p, 0), aP);
    sh = mix(sh, samp(T.mostlyCloudy, ...m, 0), aM);
    sh = mix(sh, samp(T.overcast, ...o, 0), aO);
    sh = mix(sh, samp(T.midNimbus, ...n, 0), aN);
    return [clamp(aP + aM + aO + aN, 0, 1), sh];
  },
  desktop: (T, uv, C, S, U) => {
    const u0 = uv(1.6, 0.010, 0.004);
    const cell = vfbm(u0[0] * 3, u0[1] * 3, U.time * 0.05);
    const cum = smoothstep(0.42, 0.02, cell);
    const aC = clamp(cum * C[0] * S.band * S.breakUp, 0, 1);
    const aA = samp(T.altocumulus, ...uv(0.85, 0.014, 0.009), 0) * C[1] * S.band;
    const aS = samp(T.cirrostratus, ...uv(0.45, 0.008, 0.003), 0) * C[2];
    const aI = samp(T.cirrus, ...uv(0.55, 0.030, -0.008), 0) * C[3] * 0.9;
    let sh = 1;
    sh = mix(sh, 0.55 + cell * 1.4, aC); sh = mix(sh, 0.82, aA); sh = mix(sh, 0.9, aS); sh = mix(sh, 1.0, aI);
    return [clamp(aC + aA + aS + aI, 0, 1), sh];
  },
  soft: (T, uv, C, S, U) => {
    const u0 = uv(1.3, 0.009, 0.004);
    const cell = vfbm(u0[0] * 2.6, u0[1] * 2.6, U.time * 0.04);
    const cum = smoothstep(0.60, 0.04, cell);
    const aC = clamp(cum * C[0] * S.band * S.breakUp, 0, 1);
    const aS = samp(T.cirrostratus, ...uv(0.42, 0.007, 0.003), 0) * C[2] * 1.1;
    const aI = samp(T.cirrus, ...uv(0.50, 0.026, -0.007), 0) * C[3] * 0.8;
    let sh = 1;
    sh = mix(sh, 0.62 + cell * 1.2, aC); sh = mix(sh, 0.92, aS); sh = mix(sh, 1.0, aI);
    return [clamp(aC + aS + aI, 0, 1), sh];
  },
  paintedSkies: (T, uv, C, S, U) => {
    const pu = uv(0.9, 0.008, 0.003);
    const u0 = uv(2.4, 0.010, 0.004);
    const cell = voronoi(u0[0] * 5, u0[1] * 5, U.time * 0.06);
    const edge = smoothstep(0.35, 0, cell);
    const body = samp(T.cloud, ...pu, 3) * mix(1, edge, 0.35);
    const aC = clamp(body * C[0] * S.band, 0, 1);
    const aS = samp(T.cirrostratus, ...uv(0.42, 0.007, 0.003), 0) * C[2];
    const aI = samp(T.cirrus, ...uv(0.50, 0.024, -0.006), 0) * C[3] * 0.85;
    let sh = 1;
    sh = mix(sh, samp(T.cloud, ...pu, 0), aC); sh = mix(sh, 0.9, aS); sh = mix(sh, 1.0, aI);
    return [clamp(aC + aS + aI, 0, 1), sh];
  },
  ghibliDesktop: (T, uv, C, S, U) => {
    const u0 = uv(1.15, 0.008, 0.003);
    const a = voronoi(u0[0] * 2.4, u0[1] * 2.4, U.time * 0.035);
    const b = voronoi(u0[0] * 5.1 + 7.7, u0[1] * 5.1 + 7.7, U.time * 0.06);
    const field = a * 0.7 + b * 0.3;
    const t = mix(0.55, 0.06, clamp(C[0], 0, 1));
    const body = smoothstep(t + 0.045, t - 0.045, field);
    const core = smoothstep(t - 0.02, t - 0.12, field);
    const d = clamp(body * S.band, 0, 1);
    return [d, mix(1, mix(0.98, 0.72, core), d)];
  },
  ghibliMobile: (T, uv, C, S, U) => {
    const p = uv(0.95, 0.009, 0.004);
    const t = mix(0.85, 0.05, clamp(C[0], 0, 1));
    const body = smoothstep(t + 0.06, t - 0.06, 1 - samp(T.cloud, ...p, 3));
    const d = clamp(body * S.band, 0, 1);
    return [d, mix(1, mix(0.97, 0.74, samp(T.cloud, ...p, 0)), d)];
  },
  mobile: (T, uv, C, S, U) => {
    const u0 = uv(1.25, 0.008, 0.003);
    const cell = voronoi(u0[0] * 2.6, u0[1] * 2.6, U.time * 0.04);
    const body = smoothstep(mix(0.55, 0.05, clamp(C[0], 0, 1)) + 0.18, 0, cell);
    const d = clamp(body * S.band, 0, 1);
    return [d, mix(1, 0.68 + cell * 1.5, d)];
  },
  staticTexture: (T, uv, C, S, U) => {
    const p = uv(0.9, 0, 0);
    const d = clamp(samp(T.cloud, ...p, 3) * C[0] * S.band, 0, 1);
    return [d, mix(1, samp(T.cloud, ...p, 0), d)];
  },
};

const KEYS = ["partlyCloudy","mostlyCloudy","overcast","midNimbus","luxuryVariation","cirrus","cirrostratus","altocumulus","chemtrails","cloud","cumulusNoise","stars"];
const T = {};
for (const k of KEYS) T[k] = await load(k);

const U = { zenith: hex(0x4fb6f5), horizon: hex(0xa9dcf2), lit: hex(0xffffff), dark: hex(0xb9cbdc), time: 40, wind: 0.84, scale: 0.5 };
const C = [0.6, 0.25, 0, 0];
const SHAPE = { bandHeight: 0.52, bandEffect: 1, stormReach: 1 };

function tile(fn) {
  const buf = Buffer.alloc(W * H * 3);
  const aspect = W / H, th = Math.tan(FOV / 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = ((x / W) * 2 - 1) * th * aspect, dy = (1 - (y / H) * 2) * th;
    const len = Math.hypot(dx, dy, 1);
    const dir = [dx / len, dy / len, -1 / len];
    const el = Math.max(dir[1], 0), elN = clamp(el / 0.42, 0, 1);
    const drift = U.time * (0.06 + U.wind * 0.34);
    const uv = (sc, ddx, ddy) => [dir[0] / (el + 0.28) * (U.scale * sc) + ddx * drift, dir[2] / (el + 0.28) * (U.scale * sc) + ddy * drift];
    const b = smoothstep(SHAPE.bandHeight - 0.75, SHAPE.bandHeight + 0.75, elN);
    const S = {
      band: mix(1, b, clamp(SHAPE.bandEffect, 0, 1)),
      storm: smoothstep(0, mix(0.9, 0.15, SHAPE.stormReach), elN),
      breakUp: mix(1, 0.35 + samp(T.cumulusNoise, ...uv(1.9, 0.006, 0.002), 0) * 0.9, 0.55),
    };
    const fade = smoothstep(0, 0.16, elN);
    let [den, sh] = fn(T, uv, C, S, U);
    den = clamp(den, 0, 1) * fade; sh = clamp(sh, 0, 1);
    const sky = [0,1,2].map(i => mix(U.horizon[i], U.zenith[i], Math.pow(elN, 0.7)));
    const cloud = [0,1,2].map(i => mix(U.dark[i], U.lit[i], sh));
    const o = (y * W + x) * 3;
    for (let i = 0; i < 3; i++) buf[o + i] = Math.round(clamp(Math.pow(clamp(mix(sky[i], cloud[i], den), 0, 1), 1 / 2.2), 0, 1) * 255);
  }
  return buf;
}

const ids = Object.keys(VARIANTS);
const COLS = 2, R = Math.ceil(ids.length / COLS);
const sheet = Buffer.alloc(W * COLS * H * R * 3, 18);
ids.forEach((id, i) => {
  const t = tile(VARIANTS[id]);
  const cx = (i % COLS) * W, cy = Math.floor(i / COLS) * H;
  for (let y = 0; y < H; y++) t.copy(sheet, ((cy + y) * W * COLS + cx) * 3, y * W * 3, (y + 1) * W * 3);
  console.log(`  ${String(i + 1).padStart(2)}. ${id}`);
});
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : path.join(L, "variants.png");
await sharp(sheet, { raw: { width: W * COLS, height: H * R, channels: 3 } }).png().toFile(out);
console.log(`\n${COLS} x ${R} -> ${out}`);
