#!/usr/bin/env node
/**
 * finish-bushes: the last step of art/nature/close_bushes.py (game/remodel-r2).
 *
 * Puts the dump bush's own leaf texture back on each closed bush, bit for bit (Blender's round trip re-encodes it), and
 * sets the material as the game draws the dump's: a white factor (the season tint rides in COLOR_0), opaque,
 * double-sided, the dump's roughness. Checks the model carries no node transforms (InstancedNature reads the geometry
 * as is) and is one primitive, and prints its triangles.
 *
 *   node scripts/finish-bushes.mjs public/assets/game/plants/bush-azalea-spring.glb=public/assets/acnh/plants/bush-azalea.glb ...
 */
import fs from "fs";
import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const pair of process.argv.slice(2)) {
  const [file, src] = pair.split("=");
  const doc = await io.read(file), dump = await io.read(src);
  const dumpMat = dump.getRoot().listMaterials()[0], dumpTex = dumpMat.getBaseColorTexture();
  if (!dumpTex) throw new Error(`${src}: no leaf texture`);
  const root = doc.getRoot();
  const tex = doc.createTexture(dumpTex.getName() || "leaves").setImage(dumpTex.getImage()).setMimeType(dumpTex.getMimeType());
  if (dumpTex.getMimeType() === "image/webp") doc.createExtension(ALL_EXTENSIONS.find(e => e.EXTENSION_NAME === "EXT_texture_webp"));
  for (const material of root.listMaterials()) {
    material.setName(dumpMat.getName()).setBaseColorTexture(tex).setBaseColorFactor([1, 1, 1, 1]).setAlphaMode("OPAQUE")
      .setDoubleSided(true).setRoughnessFactor(dumpMat.getRoughnessFactor()).setMetallicFactor(0);
    const info = material.getBaseColorTextureInfo();
    const dumpInfo = dumpMat.getBaseColorTextureInfo();
    if (info && dumpInfo) info.setWrapS(dumpInfo.getWrapS()).setWrapT(dumpInfo.getWrapT()).setMagFilter(dumpInfo.getMagFilter()).setMinFilter(dumpInfo.getMinFilter());
  }
  for (const node of root.listNodes()) {
    const t = node.getTranslation(), r = node.getRotation(), s = node.getScale();
    if (t.some(v => Math.abs(v) > 1e-6) || Math.abs(r[3] - 1) > 1e-6 || s.some(v => Math.abs(v - 1) > 1e-6)) throw new Error(`${file}: node ${node.getName()} carries a transform`);
  }
  const prims = root.listMeshes().flatMap(m => m.listPrimitives());
  if (prims.length !== 1 || !prims[0].getAttribute("COLOR_0")) throw new Error(`${file}: want one primitive with COLOR_0`);
  await doc.transform(prune());
  await io.write(file, doc);
  const idx = prims[0].getIndices();
  console.log(`finish-bushes ${path.basename(file)} ${(fs.statSync(file).size / 1024).toFixed(1)}KB tris=${(idx ? idx.getCount() : prims[0].getAttribute("POSITION").getCount()) / 3} texture=${dumpTex.getMimeType()}`);
}
