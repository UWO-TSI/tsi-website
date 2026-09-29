#!/usr/bin/env node
/**
 * extract-grass-fringe — the grass drape ACNH hangs over a water or cliff edge.
 *
 *   node scripts/extract-grass-fringe.mjs [--dump ~/Downloads/Assets/Model]
 *
 * `mGrassRiverXlu` is extracted, shipped, and referenced ZERO times. It is the
 * fringe that makes water meet land in ACNH instead of simply stopping where the
 * cells end, and it is the single most visible thing missing from the grid
 * world's rivers -- 621 water cells with an unfinished boundary.
 *
 * WHY IT COULD NEVER HAVE WORKED AS SHIPPED. ACNH splits these into TWO files:
 *
 *   _AlbGry   greyscale colour, tinted at runtime (that is what "Gry" means,
 *             and it is how the whole game does seasons without a second set)
 *   _OP       the opacity mask -- the actual blade shapes
 *
 * Only the _AlbGry was ever copied into public/. Measured, its alpha is 0%
 * opaque everywhere, so the material's `alphaTest: 0.4` would have discarded
 * every fragment: an invisible card. The blades live in the _OP file, which is
 * 1024x32, 64% opaque, and transparent along its top and bottom rows so the
 * fringe fades out at both ends.
 *
 * Composited here into one RGBA texture rather than bound as a separate
 * alphaMap, so the fringe costs one fetch instead of two.
 */

import fs from "fs";
import path from "path";
import url from "url";
import os from "os";
import sharp from "sharp";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const OUT = path.join(WEB, "public/assets/acnh/terrain");

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const DUMP = arg("dump", path.join(os.homedir(), "Downloads/Assets/Model"));

const FRINGES = {
  mGrassRiverXlu: "the drape over a water edge",
  mGrassCliffXlu: "the drape over a cliff lip",
};

const index = new Map();
for (const d of fs.readdirSync(DUMP, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const p = path.join(DUMP, d.name);
  let names = [];
  try { names = fs.readdirSync(p); } catch { continue; }
  for (const n of names) if (!index.has(n)) index.set(n, path.join(p, n));
}

fs.mkdirSync(OUT, { recursive: true });

for (const [name, what] of Object.entries(FRINGES)) {
  const albSrc = index.get(`${name}_AlbGry.png`);
  const opSrc = index.get(`${name}_OP.png`);
  if (!albSrc || !opSrc) {
    console.warn(`  MISSING ${name}: alb=${!!albSrc} op=${!!opSrc}`);
    continue;
  }

  const alb = sharp(albSrc);
  const meta = await alb.metadata();
  const rgb = await alb.removeAlpha().raw().toBuffer();
  // Resize the mask to the albedo in case the pair ever differs.
  const mask = await sharp(opSrc)
    .resize(meta.width, meta.height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  const px = meta.width * meta.height;
  const out = Buffer.alloc(px * 4);
  let opaque = 0;
  for (let i = 0; i < px; i++) {
    out[i * 4] = rgb[i * 3];
    out[i * 4 + 1] = rgb[i * 3 + 1];
    out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = mask[i];
    if (mask[i] > 128) opaque++;
  }

  const dst = path.join(OUT, `${name}.png`);
  await sharp(out, { raw: { width: meta.width, height: meta.height, channels: 4 } })
    .png()
    .toFile(dst);

  console.log(
    `  ${name.padEnd(16)} ${meta.width}x${meta.height}  ${(opaque / px * 100).toFixed(0)}% opaque  ${what}`
  );
}
console.log(`\n-> ${path.relative(WEB, OUT)}`);
