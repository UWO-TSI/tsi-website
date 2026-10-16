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
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { reorder } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const art = resolve(web, "../art/characters");
const out = join(web, "public/assets/characters/v6");
const data = join(web, "data/characters");
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };

const catalog = JSON.parse(readFileSync(join(art, "character_catalog.json"), "utf8"));
// wardrobe batch 2: David's Roblox accessories (art/characters/accessories/import_roblox.py) in their own section
const parts = [...catalog.outfits, ...catalog.accessories, ...catalog.hair, ...(catalog.robloxAccessories ?? [])];
for (const part of parts) copy(join(art, part.glb), join(out, part.glb));
copy(join(art, catalog.base.clips_glb), join(out, catalog.base.clips_glb));
// The verb library (classes v2): the rig's combat actions only, loaded by the ruins beside the clip base.
if (catalog.verbs) copy(join(art, catalog.verbs.glb), join(out, catalog.verbs.glb));
// LOD 1 (art/characters/build_lod.py): every part decimated, and the base's skin, for characters seen small.
const lod = JSON.parse(readFileSync(join(art, "lod1/lod.json"), "utf8"));
for (const glb of Object.keys(lod)) copy(join(art, "lod1", glb), join(out, "lod1", glb));
// LOD 2 (head-roblox): the whole hairstyles' far meshes; every other part draws its LOD 1 there.
const lod2 = JSON.parse(readFileSync(join(art, "lod2/lod.json"), "utf8"));
for (const glb of Object.keys(lod2)) copy(join(art, "lod2", glb), join(out, "lod2", glb));
// head-roblox: David's hairstyles ship their original Roblox meshes (up to ~4,300 triangles), so their web copies (every
// tier) are meshopt-compressed: lossless on the float attributes (no quantizing: the parts merge into one geometry), the
// vertices reordered for the codec. three's GLTFLoader decodes EXT_meshopt_compression (drei's useGLTF registers it).
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
const hairGlbs = catalog.hair.filter(p => p.full).map(p => p.glb);
// wardrobe batch 2: the Roblox accessories (up to 1,200 triangles) ship meshopt-compressed too, at Full and LOD 1
const accGlbs = (catalog.robloxAccessories ?? []).map(p => p.glb);
for (const [dir, glb] of [...["", "lod1/", "lod2/"].flatMap(d => hairGlbs.map(g => [d, g])), ...["", "lod1/"].flatMap(d => accGlbs.map(g => [d, g]))]) {
  const path = join(out, dir, glb);
  const doc = await io.read(path);
  await doc.transform(reorder({ encoder: MeshoptEncoder }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  await io.write(path, doc);
}
// avatar v7 face: the layer atlas at 1024 px per face canvas (creator) and 512 (world), animated by uniforms
const face = JSON.parse(readFileSync(join(art, "v7/face/face_v7.json"), "utf8"));
for (const f of [face.atlas, face.atlas_world, face.atlas2, face.atlas2_world]) copy(join(art, "v7/face", f), join(out, "base", f));
// head fit: the full hairstyles' shared shading atlas (art/characters/hair/import_hair.py)
if (catalog.hairMaps) copy(join(art, catalog.hairMaps.atlas), join(out, catalog.hairMaps.atlas));
// wardrobe batch 2: the fixed-colour atlas (art/characters/colour_atlas.py: the Roblox accessories' and #22's hat's own
// textures) and David's prices for the batch (specs/wardrobe/batch2-pricing.json)
copy(join(art, "colour_atlas.png"), join(out, "colour_atlas.png"));
copy(resolve(web, "../specs/wardrobe/batch2-pricing.json"), join(data, "batch2-pricing.json"));
for (const name of ["character_catalog.json", "palette.json", "v7/face/face_v7.json", "skull/skull.json"]) copy(join(art, name), join(data, name.replace(/^.*\//, "")));

// Crewneck decal: the site's own mark in cream on transparency, square with padding.
const svg = readFileSync(join(web, "public/logo.svg"), "utf8").replaceAll("currentColor", "#F3E9D2");
const tmp = join(out, "decal_tsi.svg");
writeFileSync(tmp, svg.replace(/<svg ([^>]*)>/, '<svg $1 preserveAspectRatio="xMidYMid meet">'));
execFileSync("rsvg-convert", ["-w", "192", "-h", "184", "-o", join(out, "decal_tsi_mark.png"), tmp]);
execFileSync("magick", [join(out, "decal_tsi_mark.png"), "-background", "none", "-gravity", "center", "-extent", "256x256", join(out, "decal_tsi_mark.png")]);
execFileSync("rm", [tmp]);
console.log(`synced ${parts.length} parts (${hairGlbs.length} hairstyles meshopt-compressed in 3 tiers, ${accGlbs.length} Roblox accessories in 2), base, ${Object.keys(lod).length} LOD 1 and ${Object.keys(lod2).length} LOD 2 GLBs, 4 face atlases (2 pages), the hair and colour atlases, 5 JSON files, TSI decal`);
