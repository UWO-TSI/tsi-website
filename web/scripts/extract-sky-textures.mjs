#!/usr/bin/env node
/**
 * extract-sky-textures — pull every cloud texture COZY's shaders reference out
 * of the .unitypackage, WHOLE.
 *
 *   node scripts/extract-sky-textures.mjs [--src <rar|unitypackage>] [--size 1024]
 *
 * NO CHANNEL PACKING, deliberately. An earlier version packed these three-to-a-
 * texture to save video memory, and it cost the look: the Luxury sheets are
 * TWO-CHANNEL data (alpha is the cloud silhouette, RGB is the painted shading
 * inside it) and squeezing each into one channel threw the shading away. The
 * sky rendered as flat white blobs. David, 2026-07-29: "why does it look so
 * boring... are these really the same assets" -- they were not.
 *
 * Space is explicitly not a constraint now, so every texture keeps all four
 * channels and each variant's shader gets exactly what its author gave it.
 *
 * WHAT THE EIGHT VARIANTS NEED, read from their .cozyshader sources:
 *
 *   Desktop         Altocumulus Chemtrails Cirrostratus Cirrus  (+ procedural)
 *   Ghibli Desktop  none -- pure voronoi
 *   Ghibli Mobile   Cloud
 *   Luxury          the full 13-texture set
 *   Mobile          none -- pure voronoi
 *   Painted Skies   Chemtrails Cirrostratus Cirrus Cloud
 *   Soft            Chemtrails Cirrostratus Cirrus
 *   Static Texture  Cloud
 */

import fs from "fs";
import path from "path";
import url from "url";
import os from "os";
import zlib from "zlib";
import { execFileSync } from "child_process";
import sharp from "sharp";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const OUT = path.join(WEB, "public/assets/sky/layers");

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const SRC = arg("src", path.join(os.homedir(), "Downloads/COZY Stylized Weather 3 v3.2.2.rar"));
const SIZE = Number(arg("size", 1024));

/** shader uniform name -> source file. */
const TEXTURES = {
  // shared detail layers
  cirrus: "Cirrus.png",
  cirrostratus: "Cirrostratus.png",
  altocumulus: "Altocumulus.png",
  chemtrails: "Chemtrails.png",
  cloud: "Cloud Map.png",
  // the Luxury coverage ladder
  partlyCloudy: "Partly Cloudy Luxury Texture.png",
  mostlyCloudy: "Mostly Cloudy Luxury Texture.png",
  overcast: "Overcast Luxury Texture.png",
  denseOvercast: "Dense Overcast Luxury Texture.png",
  lowNimbus: "Low Nimbus Luxury.png",
  midNimbus: "Medium Nimbus Luxury.png",
  highNimbus: "High Nimbus Luxury.png",
  highBorder: "Luxury Border High.png",
  luxuryVariation: "Painted Noise.png",
  // procedural helpers and night
  cumulusNoise: "Cumulus Noise.png",
  ghibliNoise: "Ghibli Noise.png",
  borderNoise: "Border Noise 2.png",
  stars: "Stars.png",
  galaxy: "Galaxy Stars.png",
  moon: "Moon Texture.png",
};

/** Star fields are sparse points and lose brightness fast when downsampled. */
const SIZE_OVERRIDE = { stars: 2048, galaxy: 2048, moon: 512 };

function readPackage(src) {
  if (src.toLowerCase().endsWith(".rar")) {
    // bsdtar (macOS built-in) reads RAR5; the archive holds one file.
    return execFileSync("tar", ["-xf", src, "-O"], { maxBuffer: 1 << 30 });
  }
  return fs.readFileSync(src);
}

/** A .unitypackage is a gzipped tar of <guid>/{asset,pathname}. */
function* tarEntries(buf) {
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = buf.toString("utf8", off, off + 100).replace(/\0.*$/, "");
    if (!name) {
      off += 512;
      continue;
    }
    const size =
      parseInt(buf.toString("ascii", off + 124, off + 136).replace(/\0.*$/, "").trim(), 8) || 0;
    yield { name, body: buf.subarray(off + 512, off + 512 + size) };
    off += 512 + Math.ceil(size / 512) * 512;
  }
}

if (!fs.existsSync(SRC)) {
  console.error(`source not found: ${SRC}`);
  process.exit(1);
}

const tar = zlib.gunzipSync(readPackage(SRC));
const nameOf = new Map();
const assetOf = new Map();
for (const { name, body } of tarEntries(tar)) {
  const slash = name.lastIndexOf("/");
  if (slash < 0) continue;
  const guid = name.slice(0, slash);
  const leaf = name.slice(slash + 1);
  // `pathname` carries a trailing "00" line; only the first line is the path.
  if (leaf === "pathname") nameOf.set(guid, body.toString("utf8").split("\n")[0].trim());
  else if (leaf === "asset") assetOf.set(guid, body);
}

const wanted = new Set(Object.values(TEXTURES));
const bodies = new Map();
for (const [guid, full] of nameOf) {
  const base = path.basename(full);
  if (wanted.has(base) && assetOf.has(guid)) bodies.set(base, assetOf.get(guid));
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith(".webp")) fs.unlinkSync(path.join(OUT, f));

const manifest = {};
let kb = 0;
let vram = 0;
console.log(`extracting ${Object.keys(TEXTURES).length} textures at ${SIZE}²\n`);

for (const [key, file] of Object.entries(TEXTURES)) {
  const body = bodies.get(file);
  if (!body) {
    console.warn(`  MISSING  ${key.padEnd(16)} ${file}`);
    continue;
  }
  const size = SIZE_OVERRIDE[key] ?? SIZE;
  const img = sharp(body, { limitInputPixels: false });
  const meta = await img.metadata();
  const stats = await img.stats();
  const alpha = stats.channels[3];
  // Recorded so a shader knows whether this sheet is one channel or two:
  // alpha varying means silhouette-plus-shading, flat means RGB is everything.
  const twoChannel = !!(alpha && alpha.stdev > 3);

  const dst = path.join(OUT, `${key}.webp`);
  await sharp(body, { limitInputPixels: false })
    .resize(size, size, { fit: "fill", kernel: "lanczos3" })
    // Lossless: these are masks, and lossy chroma subsampling would smear the
    // shading channel into the coverage one.
    .webp({ lossless: true, effort: 6 })
    .toFile(dst);

  const outKb = fs.statSync(dst).size / 1024;
  const v = (size * size * 4 * 1.33) / 1024 / 1024;
  kb += outKb;
  vram += v;
  manifest[key] = { file: `${key}.webp`, size, twoChannel };
  console.log(
    `  ${key.padEnd(16)} ${String(meta.width).padStart(4)}² -> ${String(size).padStart(4)}²  ` +
      `${outKb.toFixed(0).padStart(5)}KB  ${v.toFixed(1).padStart(5)}MB  ` +
      `${twoChannel ? "alpha=silhouette rgb=shading" : "rgb only"}`
  );
}

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `\n${Object.keys(manifest).length} textures · ${(kb / 1024).toFixed(1)}MB on disk · ${vram.toFixed(0)}MB VRAM if all bound at once`
);
console.log("(no single variant binds all of them -- Luxury needs the most, at 13)");
