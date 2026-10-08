#!/usr/bin/env node
/**
 * Copies the character art the engine ships from art/characters into the web
 * app: every catalogue GLB plus the clip-bearing base body (the catalogue's
 * base.clips_glb: v7_clips.glb, the hand-modeled v7 head) and the verb library (verbs.glb) to
 * public/assets/characters/v6/, the v7 face layer atlases next to it, the
 * catalogue/palette/face JSON to data/characters/, and the official TSI mark
 * (public/logo.svg, ruling 24) as the crewneck decal PNG, and the LOD 1 GLBs (art/characters/lod1, build_lod.py) to lod1/.
 *
 *   node web/scripts/sync-character-assets.mjs
 *
 * Re-run after any character build. lib/game/character/look.test.ts fails
 * when the copies drift from art/characters.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const art = resolve(web, "../art/characters");
const out = join(web, "public/assets/characters/v6");
const data = join(web, "data/characters");
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };

const catalog = JSON.parse(readFileSync(join(art, "character_catalog.json"), "utf8"));
const parts = [...catalog.outfits, ...catalog.accessories, ...catalog.hair];
for (const part of parts) copy(join(art, part.glb), join(out, part.glb));
copy(join(art, catalog.base.clips_glb), join(out, catalog.base.clips_glb));
// The verb library (classes v2): the rig's combat actions only, loaded by the ruins beside the clip base.
if (catalog.verbs) copy(join(art, catalog.verbs.glb), join(out, catalog.verbs.glb));
// LOD 1 (art/characters/build_lod.py): every part decimated, and the base's skin, for characters seen small.
const lod = JSON.parse(readFileSync(join(art, "lod1/lod.json"), "utf8"));
for (const glb of Object.keys(lod)) copy(join(art, "lod1", glb), join(out, "lod1", glb));
// avatar v7 face: the layer atlas at 1024 px per face canvas (creator) and 512 (world), animated by uniforms
const face = JSON.parse(readFileSync(join(art, "v7/face/face_v7.json"), "utf8"));
for (const f of [face.atlas, face.atlas_world, face.atlas2, face.atlas2_world]) copy(join(art, "v7/face", f), join(out, "base", f));
for (const name of ["character_catalog.json", "palette.json", "v7/face/face_v7.json"]) copy(join(art, name), join(data, name.replace(/^.*\//, "")));

// Crewneck decal: the site's own mark in cream on transparency, square with padding.
const svg = readFileSync(join(web, "public/logo.svg"), "utf8").replaceAll("currentColor", "#F3E9D2");
const tmp = join(out, "decal_tsi.svg");
writeFileSync(tmp, svg.replace(/<svg ([^>]*)>/, '<svg $1 preserveAspectRatio="xMidYMid meet">'));
execFileSync("rsvg-convert", ["-w", "192", "-h", "184", "-o", join(out, "decal_tsi_mark.png"), tmp]);
execFileSync("magick", [join(out, "decal_tsi_mark.png"), "-background", "none", "-gravity", "center", "-extent", "256x256", join(out, "decal_tsi_mark.png")]);
execFileSync("rm", [tmp]);
console.log(`synced ${parts.length} parts, base, ${Object.keys(lod).length} LOD GLBs, 4 face atlases (2 pages), 3 JSON files, TSI decal`);
