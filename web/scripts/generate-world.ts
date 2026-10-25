/**
 * Terrain v3: write the new world (web/data/world/) from the zone plan (lib/game/world/generate.ts PLAN).
 *
 *   cd web && npx vite-node -c vitest.config.ts scripts/generate-world.ts [--preview <png>]
 *
 * The open area's objects are laid out (layoutObjects) and the border's wall stood; the village's house, lot and
 * boat-arrival marks move with it (moveMarks); every zone's annotation is rewritten from the plan. It overwrites
 * web/data/world/, so once David sculpts in the editor it is only for regional passes. `--preview <png>` also writes the labelled top-down map, the ground a player can reach from
 * the spawn (walking, jumping, gliding: lib/game/world/reach.ts) tinted gold.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { loadWorldFromDisk, writeWorldFiles } from "../lib/game/world/disk";
import { encodeWorld } from "../lib/game/world/format";
import { BORDER, PLAN, generateWorld, layoutObjects, moveMarks } from "../lib/game/world/generate";
import { reach } from "../lib/game/world/reach";
import { PAINT_SWATCH, type WorldTerrain } from "../lib/game/world/terrain";
import { villageOfWorld } from "../lib/game/world/village";
import type { Village } from "../lib/game/villageMap";
import type { World } from "../lib/game/world/format";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(web, "data/world");
const started = Date.now();
const before = loadWorldFromDisk(dir);
const keep = before.annotations.filter(a => /^(House|Lot|Boat arrival)/.test(a.name));
const { world, report } = generateWorld(layoutObjects(before.objects), moveMarks(keep));
writeWorldFiles(dir, encodeWorld(world));
console.log(JSON.stringify({ ...report, annotations: world.annotations.length, ms: Date.now() - started }));

const at = process.argv.indexOf("--preview");
if (at > 0) await preview(world, process.argv[at + 1]);

/** A shaded relief, lit from the north-west, coloured by paint and height, the reach tinted, the zones labelled, the buildings dotted. */
async function preview(w: World, out: string) {
  const t: WorldTerrain = w.terrain, { cols, rows } = t, rgb = Buffer.alloc(cols * rows * 3);
  for (let k = 0; k < rows; k++) for (let i = 0; i < cols; i++) {
    const p = k * cols + i, h = t.heights[p];
    const gx = (t.heights[k * cols + Math.min(cols - 1, i + 1)] - t.heights[k * cols + Math.max(0, i - 1)]) * t.res / 2;
    const gz = (t.heights[Math.min(rows - 1, k + 1) * cols + i] - t.heights[Math.max(0, k - 1) * cols + i]) * t.res / 2;
    let c: readonly number[], s = 1;
    if (h <= t.seaLevel) { const e = Math.exp((h - t.seaLevel) * 0.7); c = [40 + 70 * e, 105 + 90 * e, 165 + 40 * e]; }
    else {
      c = Math.hypot(gx, gz) > 0.8 ? [150, 140, 124] : PAINT_SWATCH[t.paint[p]];
      s = Math.max(0.45, Math.min(1.35, 0.95 + (-gx - gz) * 0.28)) * (0.82 + 0.42 * Math.min(1, h / 30));
    }
    for (let j = 0; j < 3; j++) rgb[p * 3 + j] = Math.max(0, Math.min(255, Math.round(c[j] * s)));
  }
  // The reach is on a half-unit lattice offset a quarter unit from the samples: tint the sample up-left of each point.
  const r = reach(villageOfWorld(w) as Village & { terrain: WorldTerrain });
  let open = 0;
  for (const j of r.order) {
    const i = j % r.nx, k = (j - i) / r.nx, p = k * cols + i;
    if (t.heights[p] > t.seaLevel) open++;
    for (let c = 0; c < 3; c++) rgb[p * 3 + c] = Math.round(rgb[p * 3 + c] * 0.6 + [255, 214, 90][c] * 0.4);
  }
  console.log(`reach: ${(open / 4).toFixed(0)} square units of land`);
  const X = (x: number) => ((x - t.x0) * t.res).toFixed(1), Z = (z: number) => ((z - t.z0) * t.res).toFixed(1);
  let svg = `<svg width="${cols}" height="${rows}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">`;
  svg += `<polyline points="${BORDER.map(([x, z]) => `${X(x)},${Z(z)}`).join(" ")}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/>`;
  for (const o of w.objects) if (o.kind === "landmark" || o.kind === "spawn") svg += `<circle cx="${X(o.x)}" cy="${Z(o.z)}" r="2.5" fill="#d33" stroke="#fff" stroke-width="0.8"/>`;
  const labels = [...PLAN.zones.map(z => z.label), ...PLAN.ramps.map(r => r.label)].filter((l): l is readonly [string, number, number] => !!l);
  const font = `font-weight="700" text-anchor="middle" fill="#fff" stroke="#1d2a33" paint-order="stroke"`;
  for (const [text, x, z] of labels) {
    const [name, detail] = text.split(" (");
    svg += `<text x="${X(x)}" y="${Z(z)}" font-size="16" stroke-width="3.5" ${font}>${name}</text>`;
    if (detail) svg += `<text x="${X(x)}" y="${(+Z(z) + 15).toFixed(1)}" font-size="12" stroke-width="3" ${font}>(${detail}</text>`;
  }
  const note = (y: number, text: string) => `<text x="12" y="${rows - y}" font-size="13" fill="#fff" stroke="#1d2a33" stroke-width="3" paint-order="stroke">${text}</text>`;
  svg += note(30, "Terrain v3 R1b. Heights in units above the sea (a jump is 1.3). Dashed: the invisible border (opens soon).");
  svg += note(12, "Gold: where a player can get to from the spawn. Red dots: buildings and the spawn.") + "</svg>";
  await sharp(rgb, { raw: { width: cols, height: rows, channels: 3 } }).composite([{ input: Buffer.from(svg) }]).png({ compressionLevel: 9 }).toFile(out);
  console.log(`preview: ${out}`);
}
