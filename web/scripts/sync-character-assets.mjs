#!/usr/bin/env node
/**
 * Copies the character art the engine ships from art/characters into the web
 * app: every catalogue GLB plus the clip-bearing base body to
 * public/assets/characters/v6/, the face feature atlas next to them, the
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
copy(join(art, catalog.base.clips_glb), join(out, "base/v6_clips.glb"));
copy(join(art, "base/v6_face_features.png"), join(out, "base/v6_face_features.png"));
for (const name of ["character_catalog.json", "palette.json", "base/face_variants.json"]) copy(join(art, name), join(data, name.replace("base/", "")));

// Crewneck decal: the site's own mark in cream on transparency, square with padding.
const svg = readFileSync(join(web, "public/logo.svg"), "utf8").replaceAll("currentColor", "#F3E9D2");
const tmp = join(out, "decal_tsi.svg");
writeFileSync(tmp, svg.replace(/<svg ([^>]*)>/, '<svg $1 preserveAspectRatio="xMidYMid meet">'));
execFileSync("rsvg-convert", ["-w", "192", "-h", "184", "-o", join(out, "decal_tsi_mark.png"), tmp]);
execFileSync("magick", [join(out, "decal_tsi_mark.png"), "-background", "none", "-gravity", "center", "-extent", "256x256", join(out, "decal_tsi_mark.png")]);
execFileSync("rm", [tmp]);
console.log(`synced ${parts.length} parts, base, face atlas, 3 JSON files, TSI decal`);
