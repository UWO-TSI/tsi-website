#!/usr/bin/env node
/**
 * Copies the character art the engine ships from art/characters into the web
 * app: every catalogue GLB plus the clip-bearing base body (the catalogue's
 * base.clips_glb: v7_clips.glb, the hand-modeled v7 head) to
 * public/assets/characters/v6/, the v7 face layer atlases next to it, the
 * catalogue/palette/face JSON to data/characters/, and the official TSI mark
 * (public/logo.svg, ruling 24) as the crewneck decal PNG.
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
// avatar v7 face: the layer atlas at 1024 px per face canvas (creator) and 512 (world), animated by uniforms
const face = JSON.parse(readFileSync(join(art, "v7/face/face_v7.json"), "utf8"));
for (const f of [face.atlas, face.atlas_world]) copy(join(art, "v7/face", f), join(out, "base", f));
for (const name of ["character_catalog.json", "palette.json", "v7/face/face_v7.json"]) copy(join(art, name), join(data, name.replace(/^.*\//, "")));
// avatar v8: the painted strand texture the body material lays along every hair lock
copy(join(art, "v8/hair_strands.png"), join(out, "hair_strands.png"));

// Crewneck decal: the site's own mark in cream on transparency, square with padding.
const svg = readFileSync(join(web, "public/logo.svg"), "utf8").replaceAll("currentColor", "#F3E9D2");
const tmp = join(out, "decal_tsi.svg");
writeFileSync(tmp, svg.replace(/<svg ([^>]*)>/, '<svg $1 preserveAspectRatio="xMidYMid meet">'));
execFileSync("rsvg-convert", ["-w", "192", "-h", "184", "-o", join(out, "decal_tsi_mark.png"), tmp]);
execFileSync("magick", [join(out, "decal_tsi_mark.png"), "-background", "none", "-gravity", "center", "-extent", "256x256", join(out, "decal_tsi_mark.png")]);
execFileSync("rm", [tmp]);
console.log(`synced ${parts.length} parts, base, 2 face atlases, the hair strands, 3 JSON files, TSI decal`);
