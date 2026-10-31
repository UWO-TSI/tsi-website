#!/usr/bin/env node
/**
 * Copies the character art the engine ships from art/characters into the web
 * app: every catalogue GLB plus the clip-bearing base body (the catalogue's
 * base.clips_glb: v7_clips.glb, the hand-modeled v7 head), the verb library (verbs.glb) and the sushi bar staff's clips (staff.glb) to
 * public/assets/characters/v6/, the v7 face layer atlases next to it, the
 * world's textures as lossless WebP (pixel for pixel the art's PNGs, a third to a half the bytes; look.ts names them), the
 * catalogue/palette/face JSON to data/characters/, and the LOD 1 GLBs (art/characters/lod1, build_lod.py) to lod1/.
 *
 *   node web/scripts/sync-character-assets.mjs
 *
 * Re-run after any character build. lib/game/character/look.test.ts fails
 * when the copies drift from art/characters.
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { reorder } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const art = resolve(web, "../art/characters");
const out = join(web, "public/assets/characters/v6");
const data = join(web, "data/characters");
const copy = (from, to) => { mkdirSync(dirname(to), { recursive: true }); copyFileSync(from, to); };
/** A PNG to its lossless WebP (look.ts worldWebp): -exact keeps the colour under transparent texels too. */
const webp = (from, to) => { mkdirSync(dirname(to), { recursive: true }); execFileSync("cwebp", ["-quiet", "-lossless", "-exact", "-z", "9", "-metadata", "none", from, "-o", to.replace(/\.png$/, ".webp")]); };

const catalog = JSON.parse(readFileSync(join(art, "character_catalog.json"), "utf8"));
// wardrobe batch 2: David's Roblox accessories (art/characters/accessories/import_roblox.py) in their own section
const parts = [...catalog.outfits, ...catalog.accessories, ...catalog.hair, ...(catalog.robloxAccessories ?? [])];
for (const part of parts) copy(join(art, part.glb), join(out, part.glb));
copy(join(art, catalog.base.clips_glb), join(out, catalog.base.clips_glb));
// The verb library (classes v2): the rig's combat actions only, loaded by the ruins beside the clip base.
if (catalog.verbs) copy(join(art, catalog.verbs.glb), join(out, catalog.verbs.glb));
if (catalog.staff) copy(join(art, catalog.staff.glb), join(out, catalog.staff.glb));
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
for (const f of [face.atlas, face.atlas2]) copy(join(art, "v7/face", f), join(out, "base", f));
for (const f of [face.atlas_world, face.atlas2_world]) webp(join(art, "v7/face", f), join(out, "base", f));
// head fit: the full hairstyles' shared shading atlas (art/characters/hair/import_hair.py)
if (catalog.hairMaps) copy(join(art, catalog.hairMaps.atlas), join(out, catalog.hairMaps.atlas));
// round 2: its world copy at half size (like the face atlas's), a 2 x 2 box filter on each channel alone: cells and their
// padding halve exactly, and no texel's colour is weighted by its channel alpha (which a premultiplied resize would do)
if (catalog.hairMaps?.atlas_world) {
  const half = join(tmpdir(), "hair_colour_world.png");
  execFileSync("magick", [join(art, catalog.hairMaps.atlas), "-channel", "RGBA", "-separate", "-filter", "box",
    "-resize", "50%", "-combine", "-define", "png:color-type=6", half]);
  webp(half, join(out, catalog.hairMaps.atlas_world));
}
// wardrobe batch 2: the fixed-colour atlas (art/characters/colour_atlas.py: the Roblox accessories' and #22's hat's own
// textures) and David's prices for the batch (specs/wardrobe/batch2-pricing.json)
webp(join(art, "colour_atlas.png"), join(out, "colour_atlas.png"));
// clothing-v2: the garment designs, one atlas cell each (art/characters/outfits/build_outfits.py)
webp(join(art, catalog.designs.atlas), join(out, catalog.designs.atlas));
copy(resolve(web, "../specs/wardrobe/batch2-pricing.json"), join(data, "batch2-pricing.json"));
for (const name of ["character_catalog.json", "palette.json", "v7/face/face_v7.json", "skull/skull.json"]) copy(join(art, name), join(data, name.replace(/^.*\//, "")));

console.log(`synced ${parts.length} parts (${hairGlbs.length} hairstyles meshopt-compressed in 3 tiers, ${accGlbs.length} Roblox accessories in 2), base, ${Object.keys(lod).length} LOD 1 and ${Object.keys(lod2).length} LOD 2 GLBs, 4 face atlases (2 pages; the world's as WebP), the hair, colour and design atlases, 5 JSON files`);
