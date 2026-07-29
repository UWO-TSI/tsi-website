#!/usr/bin/env node
/**
 * extract-sky-textures — pull the cloud, star and border masks out of a COZY
 * `.unitypackage` and pack them into two textures a browser barely notices.
 *
 *   node scripts/extract-sky-textures.mjs [--src <rar|unitypackage>] [--size 512]
 *
 * ── WHY THIS IS NOT JUST A RESIZE ───────────────────────────────────────
 * The download was never the problem. A texture costs 4 BYTES PER TEXEL on the
 * GPU no matter how well it compresses, so a 350KB WebP and a 4MB PNG of the
 * same dimensions cost exactly the same VRAM. The source art is authored for a
 * desktop Unity build: the Luxury sheets are 4096x4096 and the star maps
 * 8192x8192. One 4096 RGBA texture is 89MB once mipmapped. Eight of them is
 * most of a laptop's video memory, on an M1 that is already the binding
 * constraint (defect D8: dpr [1,2] costs 4x the fragments on Retina before any
 * of this).
 *
 * Two things fix that properly, and only one of them is resolution:
 *
 *   1. PACKING. Every one of these layers is a single-channel MASK — a
 *      greyscale coverage map, nothing more. Storing six of them as six RGBA
 *      textures wastes most of every byte. Three masks fit in the RGB of one
 *      texture, so six become TWO. (Four would fit using alpha as well, and
 *      the first version did exactly that — see the note at the encode for why
 *      it had to be undone.)
 *
 *   2. SIZE. These are soft cloud shapes stretched across a sky dome, and the
 *      camera can never see more than 24 degrees above the horizon (measured
 *      from CameraControls' maxPolarAngle and a 48 degree FOV, and it drops to
 *      ~15 once D6 narrows the lens). There is no detail here worth 1024, let
 *      alone 4096.
 *
 * Together: 6 source textures (255MB of VRAM) become 2 at 512 (2.7MB). 96x
 * less video memory, and 307KB over the wire.
 *
 * SIZE WAS CHOSEN BY MEASUREMENT. Halving again to 256 costs 0.9-1.2% mean
 * error overall, which sounds free, but per channel it is 3.84 on stars and
 * 7.20 on altocumulus — stars are sparse bright points and are exactly what a
 * downsample eats. It would save 2MB out of the 104MB of texture memory the
 * game already spends. Not worth degrading the sky for 2%, so 512 it is;
 * `--size 256` is there if that ever changes.
 *
 * ── LOSSLESS IS MANDATORY, NOT A PREFERENCE ─────────────────────────────
 * Packed channels are independent data, not a picture. Lossy WebP does chroma
 * subsampling — it throws away colour detail because human eyes do not notice
 * it in photographs — which would smear the cumulus mask into the cirrus mask.
 * They are only "colours" by accident of storage.
 *
 * The round-trip check at the bottom is not ceremony. Packing fails SILENTLY:
 * a wrong channel order or a lossy encode still writes a perfectly valid
 * image. It caught the premultiplied-alpha bug described at the encode, which
 * nothing else would have surfaced until the sky looked wrong on screen.
 *
 * ── WHAT WAS MEASURED, NOT ASSUMED ──────────────────────────────────────
 *   · The textures are SQUARE (1:1), not equirectangular (2:1). COZY projects
 *     them onto its dome with a spherize warp, which is why none of the
 *     equirect problems (pole pinch, wrap seam, horizon pinned to the centre)
 *     apply.
 *
 *   · Seven of nine have FLAT ALPHA. `sips` reports hasAlpha=yes but the
 *     channel is 255 everywhere; the shape is a greyscale mask in RGB, the same
 *     convention our own water-caustic.png uses. Only the two "Luxury" sheets
 *     are true RGBA. Reading that wrong is silent and total — a cumulus layer
 *     sampled as alpha draws an opaque square. So the source channel is
 *     DETECTED per texture rather than hardcoded.
 *
 *   · Only some tile. Wrapping edges vs an interior control seam: Cirrus
 *     0.00/0.00 and Cumulus Noise 0.24/0.28, but Altocumulus 16.4/17.9 and the
 *     Luxury sheets 107/41. That is why the packs are split by WRAP MODE and
 *     not by what the layers are for: everything sharing a texture must share
 *     a wrap mode, or the clamped layers show a hard line across the sky.
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

const SRC = arg("src", path.join(os.homedir(), "Downloads/COZY Stylized Weather 3 v3.2.2.rar"));
const SIZE = Number(arg("size", 512));

/**
 * Two packs, three masks each in RGB.
 *
 * Both MIRRORED repeat. The Luxury sheets do not tile (measured 107 and 41 edge
 * error against an 87 control) and the cloud projection is an infinite overhead
 * sheet, so clamping would put cloud in one direction and empty sky everywhere
 * else. Mirroring makes any organic texture tile, and on shapes this irregular
 * the reflection is invisible.
 */
const PACKS = [
  { out: "sky-a", wrap: "mirror", layers: ["puffy", "chunky", "overcast"] },
  { out: "sky-b", wrap: "mirror", layers: ["storm", "noise", "stars"] },
];

/** Source file for each layer name. */
/**
 * CHOSEN BY LOOKING AT THEM, which the first pass did not do.
 *
 * Picking by filename gave `Cirrus.png` (one spiral motif), `Cirrostratus`
 * (three small clusters on black) and `Medium Nimbus Luxury` (a hard silhouette
 * blob). None are tiling cloud fields, and the spiral was the radial streak
 * artifact in the first preview. Rendering all 26 candidates as a contact sheet
 * showed the ones that matter were the sheets that had been skipped.
 *
 * These are a COVERAGE LADDER, not meteorological cloud types: partly -> mostly
 * -> overcast -> dense is increasing sky coverage, which is the axis weather
 * actually moves along, and it maps straight onto weatherSystem.ts's profiles.
 */
const SOURCE = {
  /** Discrete puffy clouds with gaps between them. The fair-weather sky. */
  puffy: "Partly Cloudy Luxury Texture.png",
  /** Bigger and denser, still broken up. */
  chunky: "Mostly Cloudy Luxury Texture.png",
  /** Continuous soft ceiling. */
  overcast: "Overcast Luxury Texture.png",
  /** Heavy dark ceiling for rain and storms. */
  storm: "Dense Overcast Luxury Texture.png",
  /** Soft fractal noise, to break the ladder up so it never reads as a decal. */
  noise: "Cumulus Noise.png",
  stars: "Stars.png",
};

// ── Read the package ─────────────────────────────────────────────

function readPackage(src) {
  if (src.toLowerCase().endsWith(".rar")) {
    // bsdtar (shipped with macOS) reads RAR5. The archive holds exactly one
    // file, so -O streams it out without a temp copy.
    console.log("reading RAR via bsdtar…");
    return execFileSync("tar", ["-xf", src, "-O"], { maxBuffer: 1 << 30 });
  }
  return fs.readFileSync(src);
}

/**
 * A .unitypackage is a gzipped tar of `<guid>/{asset,pathname,...}`. Walking
 * the 512-byte headers is thirty lines and has no failure modes we cannot see,
 * which beats a dependency for one shape of archive.
 */
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

// ── Extract ──────────────────────────────────────────────────────

if (!fs.existsSync(SRC)) {
  console.error(`source not found: ${SRC}`);
  process.exit(1);
}

const tar = zlib.gunzipSync(readPackage(SRC));
console.log(`inflated: ${(tar.length / 1024 / 1024).toFixed(0)}MB`);

// guid -> real filename. `pathname` carries a trailing "00" line, so only the
// FIRST line is the path.
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

/** basename -> raw bytes, for the files we actually want. */
const wanted = new Map(Object.entries(SOURCE).map(([k, v]) => [v, k]));
const bodies = new Map();
let sourceBytes = 0;
let sourceVram = 0;
for (const [guid, full] of nameOf) {
  const layer = wanted.get(path.basename(full));
  if (!layer) continue;
  const body = assetOf.get(guid);
  if (body) bodies.set(layer, body);
}

fs.mkdirSync(OUT, { recursive: true });

/**
 * One layer as a single-channel buffer at the target size.
 *
 * The source channel is measured, not assumed: if alpha actually varies the
 * shape is in alpha, otherwise it is the greyscale mask in red.
 */
async function maskOf(layer) {
  const body = bodies.get(layer);
  if (!body) throw new Error(`missing source for ${layer}: ${SOURCE[layer]}`);
  const img = sharp(body, { limitInputPixels: false });
  const meta = await img.metadata();
  const stats = await img.stats();
  const alpha = stats.channels[3];
  const channel = alpha && alpha.stdev > 3 ? 3 : 0;

  sourceBytes += body.length;
  sourceVram += (meta.width * meta.height * 4 * 1.33) / 1024 / 1024;

  const data = await sharp(body, { limitInputPixels: false })
    .resize(SIZE, SIZE, { fit: "fill", kernel: "lanczos3" })
    .ensureAlpha()
    .extractChannel(channel)
    .raw()
    .toBuffer();

  return { data, channel: channel === 3 ? "a" : "r", source: `${meta.width}²` };
}

const raw = { width: SIZE, height: SIZE, channels: 1 };
const manifest = { size: SIZE, packs: {} };

console.log(`\npacking ${PACKS.reduce((n,p)=>n+p.layers.length,0)} masks into ${PACKS.length} RGB textures at ${SIZE}²\n`);

for (const pack of PACKS) {
  const masks = [];
  for (const layer of pack.layers) masks.push(await maskOf(layer));

  const dst = path.join(OUT, `${pack.out}.webp`);
  // THREE masks per texture, RGB, NO ALPHA -- and that is deliberate.
  //
  // Four fit, and the first version packed four. The round-trip check below
  // then measured a mean error of 33 on the cumulus channel while alpha came
  // back exact, which is the signature of PREMULTIPLIED ALPHA: WebP multiplies
  // RGB by alpha on encode and divides it back on decode, so wherever alpha is
  // near zero the RGB beside it is destroyed. `galaxy` was in that slot and is
  // almost entirely black, so it wiped out its own neighbours.
  //
  // With no alpha channel there is nothing to premultiply by, and lossless
  // means lossless. The cost is one extra texture per six masks, which is
  // 1.3MB, and the alternative is silently corrupt cloud layers.
  await sharp(masks[0].data, { raw })
    .joinChannel(masks[1].data, { raw })
    .joinChannel(masks[2].data, { raw })
    .webp({ lossless: true, effort: 6 })
    .toFile(dst);

  const kb = fs.statSync(dst).size / 1024;
  const vram = (SIZE * SIZE * 4 * 1.33) / 1024 / 1024;
  manifest.packs[pack.out] = {
    file: `${pack.out}.webp`,
    wrap: pack.wrap,
    channels: Object.fromEntries(pack.layers.map((l, i) => [l, "rgba"[i]])),
  };

  console.log(`  ${pack.out.padEnd(12)} ${pack.wrap.padEnd(6)} ${kb.toFixed(0).padStart(4)}KB  VRAM ${vram.toFixed(1)}MB`);
  for (let i = 0; i < pack.layers.length; i++) {
    console.log(`      .${"rgba"[i]}  ${pack.layers[i].padEnd(13)} from ${masks[i].source} ${masks[i].channel}`);
  }
}

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

// ── Verify the round trip ────────────────────────────────────────
// Packing is exactly the kind of change that fails silently: a wrong channel
// order or a lossy encode still produces a valid image. Decode what was
// written and check each channel against the mask that went in.
console.log("\nverifying round trip…");
let worst = 0;
for (const pack of PACKS) {
  const decoded = await sharp(path.join(OUT, `${pack.out}.webp`)).raw().toBuffer();
  // Read the stride off the decode rather than assuming 3 or 4: an encoder is
  // free to hand back RGBA for an RGB source, and a wrong stride here would
  // report garbage errors and hide a real one.
  const stride = decoded.length / (SIZE * SIZE);
  for (let i = 0; i < pack.layers.length; i++) {
    const expect = (await maskOf(pack.layers[i])).data;
    let diff = 0;
    for (let p = 0; p < expect.length; p++) diff += Math.abs(decoded[p * stride + i] - expect[p]);
    const mean = diff / expect.length;
    worst = Math.max(worst, mean);
    console.log(`  ${pack.out}.${"rgba"[i]} = ${pack.layers[i].padEnd(13)} mean error ${mean.toFixed(4)}`);
  }
}

const outKB = PACKS.reduce((s, p) => s + fs.statSync(path.join(OUT, `${p.out}.webp`)).size / 1024, 0);
const outVram = PACKS.length * ((SIZE * SIZE * 4 * 1.33) / 1024 / 1024);
console.log(
  `\nsource  ${(sourceBytes / 1024 / 1024 / 2).toFixed(1)}MB on disk · ${(sourceVram / 2).toFixed(0)}MB VRAM` +
    `\npacked  ${outKB.toFixed(0)}KB on disk · ${outVram.toFixed(1)}MB VRAM` +
    `\nratio   ${(sourceVram / 2 / outVram).toFixed(0)}x less video memory`
);
if (worst > 0.01) console.error(`\nROUND TRIP FAILED: mean error ${worst.toFixed(4)} — encode is not lossless`);
else console.log(`round trip exact (worst channel error ${worst.toFixed(4)})`);
