#!/usr/bin/env node
/**
 * finish-trees: the last step of art/trees/build_trees.py (specs/polish/world-refinement.md §2).
 *
 * ACNH cuts its leaf cards out with an `_OP` mask that the extract never wired, so every card drew as a solid
 * hexagon. This puts each leaf material's mask from the dump into its colour texture's alpha and makes the material
 * alpha-tested (MASK, cutoff 0.5), sets the brightness of the leaves and of the inner core, checks that the model
 * carries no node transforms (InstancedNature reads the geometry as is) and no COLOR_0 (ACNH's sway weights would tint
 * the canopy), and prints the triangle counts.
 *
 *   node scripts/finish-trees.mjs public/assets/acnh/plants/tree-hardwood-a.glb ...
 */
import fs from "fs";
import os from "os";
import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";
import sharp from "sharp";

const DUMP = path.join(os.homedir(), "Downloads/Assets/Model");
/** Leaf material -> its cut-out mask in the dump. */
const MASKS = {
  mTreeOakLeaf: "PltTreeOak.Nin_NX_NVN/mTreeOakLeaf_OP.png",
  mTreeOakSakuraBloom: "PltTreeOakSakura.Nin_NX_NVN/mTreeOakSakuraBloom_OP.png",
  mTreeOakLeafSnow: "PltTreeOakSnow.Nin_NX_NVN/mTreeOakLeafSnow_OP.png",
  mTreeOakLeafSphSnow: "PltTreeOakSnow.Nin_NX_NVN/mTreeOakLeafSphSnow_OP.png",
  mPltTreeCedarLeafSnow: "PltTreeCedarSnow.Nin_NX_NVN/mPltTreeCedarLeafSnow_OP.png",
};

/**
 * Cut out, a crown shows its own depth: the screen-space AO darkens the leaves behind the gaps, where ACNH's solid
 * cards were one sheet. The oak's grey leaf atlas is lifted to keep the crown as bright as it read before.
 */
const LIFT = { mTreeOakLeaf: 1.22 };
/** The core of backing leaves inside a crown (build_trees.py): the backing atlas is darker than the leaves, and the core shows between them. */
const CORE_SHADE = 1.1;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  for (const material of root.listMaterials()) {
    const core = material.getBaseColorTexture();
    if (material.getName().endsWith("Core") && core) {
      const png = await sharp(Buffer.from(core.getImage())).removeAlpha().linear(CORE_SHADE, 0).png().toBuffer();
      material.setBaseColorTexture(doc.createTexture(`${material.getName()}_shade`).setImage(new Uint8Array(png)).setMimeType("image/png"));
    }
    const mask = MASKS[material.getName()];
    const texture = material.getBaseColorTexture();
    if (!mask || !texture) continue;
    const op = sharp(path.join(DUMP, mask));
    const { width, height } = await op.metadata();
    const alpha = await op.ensureAlpha().extractChannel(3).raw().toBuffer();
    const rgb = await sharp(Buffer.from(texture.getImage())).removeAlpha().resize(width, height).linear(LIFT[material.getName()] ?? 1, 0).raw().toBuffer();
    const png = await sharp(rgb, { raw: { width, height, channels: 3 } }).joinChannel(alpha, { raw: { width, height, channels: 1 } }).png().toBuffer();
    // A copy, so a texture another material shares keeps its own alpha.
    const cut = doc.createTexture(`${material.getName()}_cut`).setImage(new Uint8Array(png)).setMimeType("image/png");
    material.setBaseColorTexture(cut).setAlphaMode("MASK").setAlphaCutoff(0.5).setDoubleSided(true);
  }
  for (const node of root.listNodes()) {
    const t = node.getTranslation(), r = node.getRotation(), s = node.getScale();
    if (t.some(v => Math.abs(v) > 1e-6) || Math.abs(r[3] - 1) > 1e-6 || s.some(v => Math.abs(v - 1) > 1e-6)) throw new Error(`${file}: node ${node.getName()} carries a transform`);
  }
  const lines = [];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    if (prim.getAttribute("COLOR_0")) prim.setAttribute("COLOR_0", null);
    const idx = prim.getIndices();
    lines.push(`${prim.getMaterial()?.getName()}=${(idx ? idx.getCount() : prim.getAttribute("POSITION").getCount()) / 3}`);
  }
  await doc.transform(prune());
  await io.write(file, doc);
  console.log(`finish-trees ${path.basename(file)} ${(fs.statSync(file).size / 1024).toFixed(0)}KB ${lines.join(" ")}`);
}
