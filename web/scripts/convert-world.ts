/**
 * Convert the cell world (web/data/world-map.json) into the smooth world files (web/data/world/: world.json,
 * height.png, surface.png). specs/world-editor.md v0 step 2; the algorithm is lib/game/world/convert.ts.
 *
 *   cd web && npx vite-node -c vitest.config.ts scripts/convert-world.ts [--preview <dir>]
 *
 * The old file is read, never written. Running it again overwrites web/data/world/ (David's sculpting included), so
 * once he has started editing, it is only for a fresh start. `--preview <dir>` also writes a shaded top-down PNG.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { convertCells } from "../lib/game/world/convert";
import { encodeWorld } from "../lib/game/world/format";
import { writeWorldFiles } from "../lib/game/world/disk";
import { encodeIndexed } from "../lib/game/world/png";
import { PAINT_SWATCH, terrainSteepness, sampleX, sampleZ } from "../lib/game/world/terrain";
import type { VillageDoc } from "../lib/game/villageMap";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const started = Date.now();
const doc = JSON.parse(readFileSync(join(web, "data/world-map.json"), "utf8")) as VillageDoc;
const { world, report } = convertCells(doc);
const files = encodeWorld(world);
const out = join(web, "data/world");
mkdirSync(out, { recursive: true });
writeWorldFiles(out, files);

const t = world.terrain;
let land = 0, steep = 0, hi = -Infinity, lo = Infinity;
for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
  const h = t.heights[k * t.cols + i];
  hi = Math.max(hi, h); lo = Math.min(lo, h);
  if (h > t.seaLevel) { land++; if (terrainSteepness(t, sampleX(t, i), sampleZ(t, k)) > 1) steep++; }
}
console.log(JSON.stringify({ ...report, samples: t.heights.length, land, steepLand: steep, heights: [+lo.toFixed(2), +hi.toFixed(2)],
  bytes: { json: files.json.length, height: files.height.length, surface: files.surface.length }, ms: Date.now() - started }));

const at = process.argv.indexOf("--preview");
if (at > 0) {
  // A shaded relief, coloured by paint and water depth: light from the north-west.
  const dir = process.argv[at + 1];
  const ids = new Uint8Array(t.cols * t.rows), palette: [number, number, number][] = [];
  const key = new Map<string, number>();
  for (let k = 0; k < t.rows; k++) for (let i = 0; i < t.cols; i++) {
    const p = k * t.cols + i, h = t.heights[p];
    const gx = (t.heights[k * t.cols + Math.min(t.cols - 1, i + 1)] - t.heights[k * t.cols + Math.max(0, i - 1)]) * t.res / 2;
    const gz = (t.heights[Math.min(t.rows - 1, k + 1) * t.cols + i] - t.heights[Math.max(0, k - 1) * t.cols + i]) * t.res / 2;
    const shade = Math.max(0.35, Math.min(1.25, 0.85 + (-gx - gz) * 0.35));
    let c: readonly number[] = h <= t.seaLevel ? [60 + 50 * Math.exp((h - t.seaLevel) * 0.8), 110 + 60 * Math.exp((h - t.seaLevel) * 0.8), 170] : PAINT_SWATCH[t.paint[p]];
    if (h > t.seaLevel && Math.hypot(gx, gz) > 0.6) c = [140, 133, 119];
    const q = (v: number) => Math.max(0, Math.min(255, Math.round((v * (h > t.seaLevel ? shade : 1)) / 24) * 24));
    const rgb: [number, number, number] = [q(c[0]), q(c[1]), q(c[2])], s = rgb.join(",");
    let id = key.get(s);
    if (id === undefined) { id = palette.length; palette.push(rgb); key.set(s, id); }
    if (id > 255) throw new Error("preview palette overflow");
    ids[p] = id;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "world-preview.png"), encodeIndexed(ids, t.cols, t.rows, palette));
  console.log(`preview: ${join(dir, "world-preview.png")}`);
}
