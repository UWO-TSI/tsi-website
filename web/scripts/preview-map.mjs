#!/usr/bin/env node
/**
 * preview-map — top-down PNG of data/island-map.json.
 *
 *   node scripts/preview-map.mjs [--in data/island-map.json] [--out /tmp/map.png] [--px 6]
 *
 * The 3D grid renderer is M4, so until that lands this is the only way to see
 * what the map actually says. Surface picks the hue, elevation picks the
 * brightness, and a cliff edge (any 4-neighbour at a lower level) is outlined
 * so terracing reads at a glance. Props are dotted on top.
 */

import fs from "fs";
import path from "path";
import url from "url";
import sharp from "sharp";

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const grid = await import(path.join(WEB, "lib/game/grid.ts"));
const { Surface } = grid;

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i === -1 ? d : process.argv[i + 1];
};

const inPath = path.join(WEB, arg("--in", "data/island-map.json"));
const outPath = arg("--out", "/tmp/island-map.png");
const PX = Number(arg("--px", "6"));

const doc = JSON.parse(fs.readFileSync(inPath, "utf8"));
const { map, props } = grid.parseIslandMap(doc);

// Base hue per surface, at level 0.
const HUE = {
  [Surface.Grass]: [124, 174, 86],
  [Surface.Soil]: [186, 150, 100],
  [Surface.Stone]: [176, 172, 166],
  [Surface.Sand]: [226, 203, 147],
  [Surface.Wood]: [160, 120, 78],
  [Surface.Brick]: [186, 122, 104],
  [Surface.River]: [86, 140, 178],
  [Surface.Void]: [40, 62, 88],
};

const PROP_DOT = {
  building: [255, 255, 255],
  tree: [40, 92, 46],
  bush: [96, 150, 92],
  flower: [232, 128, 176],
  lamp: [250, 226, 140],
  npc: [255, 140, 90],
};

const W = map.width * PX;
const H = map.depth * PX;
const buf = Buffer.alloc(W * H * 3);

function put(px, py, rgb) {
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  const o = (py * W + px) * 3;
  buf[o] = rgb[0];
  buf[o + 1] = rgb[1];
  buf[o + 2] = rgb[2];
}

for (let cz = 0; cz < map.depth; cz++) {
  for (let cx = 0; cx < map.width; cx++) {
    const s = grid.surfaceAt(map, cx, cz);
    const lvl = grid.levelAt(map, cx, cz);
    const base = HUE[s] ?? [255, 0, 255];
    // Each level up lightens the cell — the same trick a contour map uses.
    const lift = grid.isVoid(s) ? 1 : 1 + lvl * 0.22;
    const rgb = base.map((c) => Math.min(255, Math.round(c * lift)));

    // Outline any edge where the ground steps down: that is a cliff face.
    const stepsDown =
      !grid.isVoid(s) &&
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dz]) => grid.levelAt(map, cx + dx, cz + dz) < lvl);

    for (let py = 0; py < PX; py++) {
      for (let px = 0; px < PX; px++) {
        const edge = stepsDown && (px === 0 || py === 0 || px === PX - 1 || py === PX - 1);
        put(cx * PX + px, cz * PX + py, edge ? [56, 40, 30] : rgb);
      }
    }
  }
}

for (const p of props) {
  const [cx, cz] = p.cell;
  const rgb = PROP_DOT[p.kind] ?? [255, 255, 255];
  const r = p.kind === "building" ? 2 : 1;
  const ox = cx * PX + PX / 2;
  const oy = cz * PX + PX / 2;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) put(Math.round(ox + dx), Math.round(oy + dy), rgb);
}

await sharp(buf, { raw: { width: W, height: H, channels: 3 } })
  .png()
  .toFile(outPath);

const counts = new Map();
for (let i = 0; i < map.levels.length; i++) {
  if (grid.isVoid(map.surfaces[i])) continue;
  counts.set(map.levels[i], (counts.get(map.levels[i]) ?? 0) + 1);
}
const land = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(`${outPath}  ${W}x${H}  (${PX}px per cell)`);
console.log(`land cells: ${land}`);
for (const [lvl, n] of [...counts].sort((a, b) => a[0] - b[0])) {
  console.log(`  level ${lvl}: ${String(n).padStart(6)}  ${((n / land) * 100).toFixed(1)}%`);
}
