#!/usr/bin/env node
/**
 * finish-greenery: the last step of art/trees/build_broadleaf.py, build_conifers.py and build_flowers.py
 * (game/remodel-trees).
 *
 * Sets each material as the game draws it: the leaf, needle and petal cards cut out at 0.5 (alpha MASK) and drawn
 * from both sides; the bark and stems opaque; every one matte (roughness 1, no metal) with a white factor (the shade
 * rides in COLOR_0). Turns the painted PNGs into WebP (EXT_texture_webp), checks the model carries no node transforms
 * (InstancedNature reads the geometry as is) and that every coloured primitive has COLOR_0, and prints its triangles.
 *
 *   node scripts/finish-greenery.mjs public/assets/game/plants/tree-round-summer.glb ...
 */
import fs from "fs";
import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import { prune, dedup } from "@gltf-transform/functions";
import sharp from "sharp";

/** Cut-out cards: the leaves, needles, petals and flower leaves. */
const CUT = /^m(TreeLeaves|Needles|Petals|FlowerLeaves)$/;
const CASTER = /^mShadow(Shake)?$/;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  const webp = doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const texture of root.listTextures()) {
    if (texture.getMimeType() === "image/webp") continue;
    const img = await sharp(Buffer.from(texture.getImage())).webp({ quality: 90, alphaQuality: 100, effort: 6, smartSubsample: true }).toBuffer();
    texture.setImage(new Uint8Array(img)).setMimeType("image/webp");
    if (texture.getURI()) texture.setURI(texture.getURI().replace(/\.png$/, ".webp"));
  }
  if (!root.listTextures().length) webp.dispose();
  for (const material of root.listMaterials()) {
    const name = material.getName();
    material.setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true).setEmissiveFactor([0, 0, 0]);
    if (CUT.test(name)) material.setAlphaMode("MASK").setAlphaCutoff(0.5);
    else material.setAlphaMode("OPAQUE");
    if (CASTER.test(name)) material.setBaseColorTexture(null);
  }
  for (const node of root.listNodes()) {
    const t = node.getTranslation(), r = node.getRotation(), s = node.getScale();
    if (t.some(v => Math.abs(v) > 1e-6) || Math.abs(r[3] - 1) > 1e-6 || s.some(v => Math.abs(v - 1) > 1e-6)) throw new Error(`${file}: node ${node.getName()} carries a transform`);
  }
  const lines = [];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const name = prim.getMaterial()?.getName() ?? "";
    if (CASTER.test(name)) {
      // A caster is depth only: no colour, no texture coordinates.
      prim.setAttribute("COLOR_0", null).setAttribute("TEXCOORD_0", null);
    } else if (!prim.getAttribute("COLOR_0")) throw new Error(`${file}: ${name} has no COLOR_0`);
    const idx = prim.getIndices();
    lines.push(`${name}=${(idx ? idx.getCount() : prim.getAttribute("POSITION").getCount()) / 3}`);
  }
  await doc.transform(dedup(), prune());
  await io.write(file, doc);
  console.log(`finish-greenery ${path.basename(file)} ${(fs.statSync(file).size / 1024).toFixed(0)}KB ${lines.join(" ")}`);
}
