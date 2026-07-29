#!/usr/bin/env node
/**
 * extract-road-textures — the four ACNH road surfaces the grid draws as flat
 * hex colours.
 *
 *   node scripts/extract-road-textures.mjs [--dump ~/Downloads/Assets/Model]
 *
 * GridTerrain currently paints Soil, Stone, Wood and Brick as literal hex
 * constants (#BA9664, #B0ACA6, #A0784E, #BA7A68). Four of its seven surfaces
 * have no texture at all, and that is the single largest reason the grid world
 * reads as unfinished next to the old mesh terrain.
 *
 * TWO TRAPS, BOTH ALREADY DOCUMENTED IN terrainMaterials.ts, BOTH RE-VERIFIED
 * HERE RATHER THAN ASSUMED:
 *
 * 1. `_Grd` IS NOT AN ALBEDO. Every road material ships one, and every one is a
 *    32x48 or 64x48 grid of flat colour swatches -- a SEASONAL RAMP that ACNH
 *    samples a single cell of. Tiling one across the ground paints the whole
 *    palette on as hard stripes, which is exactly what mGrass_Grd did to the
 *    lawn. Measured per file below; only `_Alb` and `_AlbOry` are real.
 *
 * 2. THE NORMAL MAPS ARE TWO-CHANNEL. All four have a flat-zero blue channel,
 *    so Z is implied and must be reconstructed as sqrt(1 - x^2 - y^2). Three's
 *    standard material does not do that, so the raw file FLATTENS lighting
 *    instead of adding to it -- mGrass_Nrm rendered the entire ground black
 *    that way. Reconstructed here, at extract time, so nothing downstream has
 *    to know.
 */

import fs from "fs";
import path from "path";
import url from "url";
import os from "os";
import sharp from "sharp";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const OUT = path.join(WEB, "public/assets/acnh/road");

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const DUMP = arg("dump", path.join(os.homedir(), "Downloads/Assets/Model"));

/** grid surface -> the ACNH files that actually carry it. */
const SURFACES = {
  mRoadSoil: { alb: "mRoadSoil_AlbOry.png", nrm: "mRoadSoil_Nrm.png" },
  mRoadStone: { alb: "mRoadStone_Alb.png", nrm: "mRoadStone_Nrm.png" },
  mRoadWood: { alb: "mRoadWood_Alb.png", nrm: "mRoadWood_Nrm.png" },
  mRoadBrick: { alb: "mRoadBrick_Alb.png", nrm: "mRoadBrick_Nrm.png" },
};

/** Find a file anywhere one level down in the dump. */
const dirs = fs.readdirSync(DUMP, { withFileTypes: true }).filter((d) => d.isDirectory());
const index = new Map();
for (const d of dirs) {
  const p = path.join(DUMP, d.name);
  let names = [];
  try { names = fs.readdirSync(p); } catch { continue; }
  for (const n of names) if (!index.has(n)) index.set(n, path.join(p, n));
}
console.log(`indexed ${index.size} files across ${dirs.length} dump dirs\n`);

fs.mkdirSync(OUT, { recursive: true });
let ok = 0;

for (const [mat, files] of Object.entries(SURFACES)) {
  const albSrc = index.get(files.alb);
  if (!albSrc) { console.warn(`  MISSING albedo ${files.alb}`); continue; }

  // Guard the _Grd trap generically: a real ground texture is never tiny.
  const albMeta = await sharp(albSrc).metadata();
  if (albMeta.width < 80 || albMeta.height < 80) {
    console.warn(`  REJECTED ${files.alb} at ${albMeta.width}x${albMeta.height} -- too small to be an albedo, this is a swatch ramp`);
    continue;
  }

  const albDst = path.join(OUT, `${mat}_Alb.png`);
  await sharp(albSrc).png().toFile(albDst);

  let nrmNote = "no normal";
  const nrmSrc = index.get(files.nrm);
  if (nrmSrc) {
    const { data, info } = await sharp(nrmSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = info.width * info.height;
    let blueSum = 0;
    for (let i = 0; i < px; i++) blueSum += data[i * 4 + 2];
    const twoChannel = blueSum / px < 8;

    if (twoChannel) {
      // Z = sqrt(1 - x^2 - y^2) in tangent space, with x,y remapped from 0..255.
      for (let i = 0; i < px; i++) {
        const x = (data[i * 4] / 255) * 2 - 1;
        const y = (data[i * 4 + 1] / 255) * 2 - 1;
        const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
        data[i * 4 + 2] = Math.round((z * 0.5 + 0.5) * 255);
      }
    }
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(path.join(OUT, `${mat}_Nrm.png`));
    nrmNote = twoChannel ? "normal: Z RECONSTRUCTED" : "normal: already full RGB";
  }

  ok++;
  console.log(`  ${mat.padEnd(12)} ${String(albMeta.width).padStart(4)}²  ${files.alb.padEnd(24)} ${nrmNote}`);
}

console.log(`\n${ok}/${Object.keys(SURFACES).length} road surfaces -> ${path.relative(WEB, OUT)}`);
