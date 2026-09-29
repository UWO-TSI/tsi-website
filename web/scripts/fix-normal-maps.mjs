#!/usr/bin/env node
/**
 * fix-normal-maps — reconstruct the Z channel of ACNH's two-channel normal maps.
 *
 *   node scripts/fix-normal-maps.mjs [--check]
 *
 * WHY. `mGrass_Nrm.png` measures a mean of (128, 128, 0): the blue channel is
 * ZERO everywhere. That is a two-channel tangent normal map, the standard
 * console packing — X and Y are stored, Z is implied by `z = sqrt(1 - x² - y²)`
 * because a unit normal has no third degree of freedom.
 *
 * Three's MeshStandardMaterial does not reconstruct it. It reads the RGB
 * literally, so every normal comes out pointing along the surface instead of out
 * of it, every lambert term collapses, and the ground renders BLACK. That is
 * exactly what happened the first time the map was wired up.
 *
 * The alternative fix is a shader patch on `normal_fragment_maps`. This is
 * better: it is a one-time cost, it leaves the material stock, and the file on
 * disk becomes a normal map that any tool can read correctly.
 */

import fs from "fs";
import path from "path";
import url from "url";
import sharp from "sharp";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "../public/assets/acnh/terrain");
const check = process.argv.includes("--check");

const files = fs.readdirSync(DIR).filter((f) => /_Nrm[A-Za-z]*\.png$/.test(f));
if (files.length === 0) {
  console.log("no *_Nrm*.png in", path.relative(process.cwd(), DIR));
  process.exit(0);
}

let fixed = 0;
for (const file of files) {
  const p = path.join(DIR, file);
  const img = sharp(p);
  const { width, height, channels } = await img.metadata();
  const raw = await img.raw().toBuffer();

  // Only touch maps whose blue channel is actually flat-zero. A correctly
  // packed normal map must be left alone.
  let maxBlue = 0;
  for (let i = 2; i < raw.length; i += channels) maxBlue = Math.max(maxBlue, raw[i]);
  if (maxBlue > 8) {
    console.log(`  ${file.padEnd(24)} blue max ${maxBlue} — already three-channel, skipped`);
    continue;
  }

  for (let i = 0; i < raw.length; i += channels) {
    const nx = (raw[i] / 255) * 2 - 1;
    const ny = (raw[i + 1] / 255) * 2 - 1;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    raw[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
  }

  console.log(`  ${file.padEnd(24)} blue max ${maxBlue} -> reconstructed`);
  fixed++;
  if (!check) {
    await sharp(raw, { raw: { width, height, channels } })
      .png()
      .toFile(p + ".tmp");
    fs.renameSync(p + ".tmp", p);
  }
}

console.log(check ? `\n--check: ${fixed} would be rewritten` : `\nrewrote ${fixed} file(s)`);
