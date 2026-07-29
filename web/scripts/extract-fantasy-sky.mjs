#!/usr/bin/env node
/**
 * extract-fantasy-sky — wire Fantasy Skybox FREE's panoramas into our sky.
 *
 *   node scripts/extract-fantasy-sky.mjs [--set FS002] [--size 2048]
 *
 * David owns Fantasy Skybox FREE (Render Knight); it is already unpacked inside
 * two of his Unity projects, so this reads the loose PNGs rather than a
 * .unitypackage.
 *
 * WHY THIS IS THE SHORT PATH. Our sky dome has ALWAYS been four equirect
 * panoramas crossfaded by hour, with a second drifting cloud shell for
 * parallax (GameWorld.tsx:284). That architecture was right; what it lacked was
 * art. The eight files it loads were 7-13KB placeholder gradients baked from
 * the time-of-day palette, and the code comment even says so: "David's AI art
 * drops into /assets/sky/ as a file swap".
 *
 * These are that file swap. 2048x1024, exactly 2:1, which is the contract
 * already in place -- so this needs no shader, no compositing, and no
 * reconstruction of anyone else's work.
 *
 * SUNLESS AND MOONLESS ARE THE POINT. The pack ships each sky twice, once with
 * the sun or moon painted in and once without. We draw our own ACNH sun.png and
 * moon.png sprites over the dome, so the painted ones would give two suns. The
 * mapping below takes the empty versions wherever they exist.
 *
 * Sunrise and Sunset have no sunless variant -- the sun IS the composition at
 * those hours -- so those keep theirs, and GameWorld should fade its own sprite
 * out near the horizon rather than stack a second one on top.
 */

import fs from "fs";
import path from "path";
import url from "url";
import sharp from "sharp";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const OUT = path.join(WEB, "public/assets/sky");

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const SET = arg("set", "FS002");
const SIZE = Number(arg("size", 2048));

const ROOTS = [
  "/Users/DavidLiu/Documents/GitHub/groupproject-unitypot/Assets/Stuff/Terrain/Fantasy Skybox FREE/Panoramics",
  "/Users/DavidLiu/Documents/GitHub/UnityRPG-UnityPot/Assets/Stuff/Terrain/Fantasy Skybox FREE/Panoramics",
];

/**
 * our filename <- pack variant.
 *
 * Rain reuses one sheet across morning, afternoon and evening because the pack
 * ships a single Rainy per set, and under a full overcast the hour barely
 * shows anyway. Night rain takes Moonless instead, which is genuinely darker.
 */
const MAP = {
  sky_morning_sunny: "Sunrise",
  sky_afternoon_sunny: "Day_Sunless",
  sky_evening_sunny: "Sunset",
  sky_night_sunny: "Night_Moonless",
  sky_morning_rain: "Rainy",
  sky_afternoon_rain: "Rainy",
  sky_evening_rain: "Rainy",
  sky_night_rain: "Night_Moonless",
};

const root = ROOTS.find((r) => fs.existsSync(path.join(r, SET)));
if (!root) {
  console.error(`set ${SET} not found. Looked in:\n  ${ROOTS.join("\n  ")}`);
  process.exit(1);
}

console.log(`${SET} from ${root.replace(process.env.HOME, "~")}\n`);
fs.mkdirSync(OUT, { recursive: true });

let kb = 0;
for (const [dst, variant] of Object.entries(MAP)) {
  const src = path.join(root, SET, `${SET}_${variant}.png`);
  if (!fs.existsSync(src)) {
    console.warn(`  MISSING ${variant}`);
    continue;
  }
  const out = path.join(OUT, `${dst}.webp`);
  const before = fs.existsSync(out) ? fs.statSync(out).size / 1024 : 0;
  await sharp(src, { limitInputPixels: false })
    .resize(SIZE, SIZE / 2, { fit: "fill", kernel: "lanczos3" })
    .webp({ quality: 90, effort: 6 })
    .toFile(out);
  const after = fs.statSync(out).size / 1024;
  kb += after;
  console.log(
    `  ${dst.padEnd(22)} <- ${variant.padEnd(15)} ${before.toFixed(0).padStart(5)}KB -> ${after.toFixed(0).padStart(5)}KB`
  );
}

const vram = (8 * SIZE * (SIZE / 2) * 4 * 1.33) / 1024 / 1024;
console.log(`\n8 panoramas · ${(kb / 1024).toFixed(1)}MB on disk · ${vram.toFixed(0)}MB VRAM`);
console.log(`other sets: FS003 (bigger, more dramatic), FS013 (dark, god rays), FS017 (hazy, thin)`);
