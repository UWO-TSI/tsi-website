#!/usr/bin/env node
/**
 * extract-sky-textures — pull the cloud, star and moon layers out of a COZY
 * `.unitypackage` and process them into something a browser can actually hold.
 *
 *   node scripts/extract-sky-textures.mjs [--src <rar|unitypackage>]
 *
 * WHY PROCESSING IS NOT OPTIONAL. The source art is authored for a desktop
 * Unity build. Measured: the Luxury cloud sheets are 4096x4096 and the star
 * maps are 8192x8192. Download size is not the problem — VRAM is. An
 * uncompressed 4096x4096 RGBA texture is 67MB on the GPU, 89MB once mipmapped,
 * EACH. Five cloud layers at source resolution is roughly 450MB of video
 * memory, on an M1 that is already the binding constraint (defect D8: dpr
 * [1,2] costs 4x the fragments on Retina before any of this).
 *
 * At 1024 that is 4MB per layer and 20MB for the set. A stylised cel sky has
 * no use for the extra detail anyway; the cloud SHAPES are what matter and
 * they survive the downsample intact.
 *
 * WHAT THE MEASUREMENTS SAID. Two facts drove the mapping below, and both came
 * from testing the pixels rather than from the filenames:
 *
 *   · The textures are SQUARE (1:1), not equirectangular (2:1). COZY projects
 *     them onto its dome with a spherize warp — which is why none of the
 *     equirect problems (pole pinch, seam at the wrap, horizon pinned to the
 *     vertical centre) apply to them.
 *
 *   · Only SOME of them tile. Comparing wrapping edges against an interior
 *     control seam: `Cirrus` is perfect (0.00 / 0.00) and `Cumulus Noise` is
 *     effectively perfect (0.24 / 0.28), while `Altocumulus` (16.4 / 17.9) and
 *     the Luxury sheets (107 / 41) are not. So there are two classes: tiling
 *     noise that scrolls forever, and one-shot coverage sheets mapped once.
 *     They need different wrap modes, and getting that wrong shows as a hard
 *     line across the sky.
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

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
};

const SRC = arg(
  "src",
  path.join(os.homedir(), "Downloads/COZY Stylized Weather 3 v3.2.2.rar")
);

/**
 * source name -> { out, size, tiles }
 *
 * `tiles` decides the wrap mode at runtime, so it is recorded in the manifest
 * rather than guessed later.
 */
const WANT = {
  "Cumulus Noise.png": { out: "cumulus", size: 1024, tiles: true },
  "Altocumulus.png": { out: "altocumulus", size: 1024, tiles: false },
  "Cirrus.png": { out: "cirrus", size: 1024, tiles: true },
  "Cirrostratus.png": { out: "cirrostratus", size: 1024, tiles: false },
  "Medium Nimbus Luxury.png": { out: "nimbus", size: 1024, tiles: false },
  "Luxury Border High.png": { out: "border", size: 512, tiles: false },
  "Stars.png": { out: "stars", size: 1024, tiles: true },
  "Galaxy Stars.png": { out: "galaxy", size: 1024, tiles: true },
};

// ── Read the package ─────────────────────────────────────────────

function readPackage(src) {
  if (src.toLowerCase().endsWith(".rar")) {
    // bsdtar (shipped with macOS) reads RAR5. The archive holds exactly one
    // file, so -O streams it straight out without a temp copy.
    console.log("reading RAR via bsdtar…");
    return execFileSync("tar", ["-xf", src, "-O"], { maxBuffer: 1 << 30 });
  }
  return fs.readFileSync(src);
}

/**
 * A .unitypackage is a gzipped tar of `<guid>/{asset,pathname,...}`. Rather
 * than pull in a tar dependency for one shape of archive, walk the 512-byte
 * headers directly — it is about thirty lines and has no failure modes we
 * cannot see.
 */
function* tarEntries(buf) {
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = buf.toString("utf8", off, off + 100).replace(/\0.*$/, "");
    if (!name) {
      off += 512;
      continue;
    }
    const size = parseInt(buf.toString("ascii", off + 124, off + 136).replace(/\0.*$/, "").trim(), 8) || 0;
    const body = buf.subarray(off + 512, off + 512 + size);
    yield { name, body };
    off += 512 + Math.ceil(size / 512) * 512;
  }
}

// ── Extract ──────────────────────────────────────────────────────

if (!fs.existsSync(SRC)) {
  console.error(`source not found: ${SRC}`);
  process.exit(1);
}

const tgz = readPackage(SRC);
console.log(`package: ${(tgz.length / 1024 / 1024).toFixed(0)}MB`);
const tar = zlib.gunzipSync(tgz);
console.log(`inflated: ${(tar.length / 1024 / 1024).toFixed(0)}MB`);

// First pass: guid -> real filename. `pathname` carries a trailing "00" line,
// so only the FIRST line is the path.
const nameOf = new Map();
const assetOf = new Map();
for (const { name, body } of tarEntries(tar)) {
  const slash = name.lastIndexOf("/");
  if (slash < 0) continue;
  const guid = name.slice(0, slash);
  const leaf = name.slice(slash + 1);
  if (leaf === "pathname") nameOf.set(guid, body.toString("utf8").split("\n")[0].trim());
  else if (leaf === "asset") assetOf.set(guid, body);
}
console.log(`entries: ${nameOf.size} assets\n`);

fs.mkdirSync(OUT, { recursive: true });

const manifest = {};
let found = 0;
for (const [guid, full] of nameOf) {
  const base = path.basename(full);
  const spec = WANT[base];
  if (!spec) continue;
  const body = assetOf.get(guid);
  if (!body) {
    console.warn(`  ${base}: no asset body`);
    continue;
  }
  found++;

  const img = sharp(body, { limitInputPixels: false });
  const meta = await img.metadata();
  const dst = path.join(OUT, `${spec.out}.webp`);

  /**
   * WHICH CHANNEL CARRIES THE SHAPE, measured rather than assumed.
   *
   * `sips` reports hasAlpha=yes on nearly all of these, but the channel is
   * flat 255 on seven of the nine — the shape is a GREYSCALE MASK in RGB, the
   * same convention our own `water-caustic.png` uses. Only the two "Luxury"
   * sheets are true RGBA.
   *
   * Reading this wrong is silent and total: a cumulus layer sampled as alpha
   * would draw an opaque square (alpha is 255 everywhere), and cirrus sampled
   * as alpha would be an invisible black sheet. So the answer goes in the
   * manifest and the shader reads the channel it is told to.
   */
  const stats = await img.stats();
  const alpha = stats.channels[3];
  const channel = alpha && alpha.stdev > 3 ? "a" : "r";

  await sharp(body, { limitInputPixels: false })
    .resize(spec.size, spec.size, { fit: "fill", kernel: "lanczos3" })
    .webp({ quality: 86, alphaQuality: 90, effort: 6 })
    .toFile(dst);

  const before = body.length / 1024;
  const after = fs.statSync(dst).size / 1024;
  // GPU cost is what actually matters: 4 bytes per texel, x1.33 for mipmaps.
  const vramBefore = (meta.width * meta.height * 4 * 1.33) / 1024 / 1024;
  const vramAfter = (spec.size * spec.size * 4 * 1.33) / 1024 / 1024;

  manifest[spec.out] = { file: `${spec.out}.webp`, size: spec.size, tiles: spec.tiles, channel };

  console.log(
    `  ${spec.out.padEnd(13)} ${String(meta.width).padStart(4)}² -> ${spec.size}²  ` +
      `${before.toFixed(0).padStart(6)}KB -> ${after.toFixed(0).padStart(4)}KB  ` +
      `VRAM ${vramBefore.toFixed(0).padStart(3)}MB -> ${vramAfter.toFixed(1)}MB  ` +
      `${spec.tiles ? "tiling" : "clamped"}  .${channel}`
  );
}

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const missing = Object.keys(WANT).filter((k) => !manifest[WANT[k].out]);
if (missing.length) console.warn(`\nNOT FOUND: ${missing.join(", ")}`);

const totalKB = Object.values(manifest).reduce(
  (s, m) => s + fs.statSync(path.join(OUT, m.file)).size / 1024,
  0
);
const totalVram = Object.values(manifest).reduce((s, m) => s + (m.size * m.size * 4 * 1.33) / 1024 / 1024, 0);
console.log(
  `\n${found}/${Object.keys(WANT).length} layers -> ${path.relative(WEB, OUT)}` +
    `\ndownload ${totalKB.toFixed(0)}KB · VRAM ${totalVram.toFixed(0)}MB`
);
