#!/usr/bin/env node
// Restore original furniture geometry and default finishes without modifying the source dump.
import { copyFile, mkdtemp, stat, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds, prune, transformPrimitive } from "@gltf-transform/functions";

const furniture = {
  wood: { model: "FtrWoodBench", output: "bench-wood", meshes: 1, size: [1.94533515, 0.51064712, 0.52800059] },
  park: { model: "FtrParkbenche", output: "bench-park", meshes: 1, size: [1.75375214, 1.00475866, 0.95076203] },
  clock: { model: "FtrParkclock", output: "park-clock", meshes: 2, size: [0.67092419, 2.67856293, 0.56309319] },
};

export async function restoreFurniture(selection = "all", source = path.join(homedir(), "Downloads/Assets/Model")) {
  const selected = Array.isArray(selection) ? selection : selection === "all" ? Object.keys(furniture) : [selection];
  if (selected.some(key => !Object.hasOwn(furniture, key))) throw new Error("Choose wood, park, clock or all");
  for (const key of selected) {
    const item = furniture[key];
    const output = path.resolve(`public/assets/acnh/props/${item.output}.glb`);
    const work = await mkdtemp(path.join(tmpdir(), "tethos-furniture-"));
    const modelDir = path.join(source, `${item.model}.Nin_NX_NVN`);
    const variantDir = path.join(source, `${item.model}ReBody0.Nin_NX_NVN`);
    for (const directory of [modelDir, variantDir]) {
      for (const file of await readdir(directory)) {
        if (file.endsWith(".png")) await copyFile(path.join(directory, file), path.join(work, file));
      }
    }
    let dae = await readFile(path.join(modelDir, `${item.model}.dae`), "utf8");
    // Variant textures are referenced by some effects but absent from library_images.
    for (const suffix of ["Alb", "Nrm", "Mix"]) {
      const id = `mReBody_${suffix}`;
      if (!dae.includes(`<image id="${id}"`)) {
        if (!dae.includes("</library_images>")) throw new Error("Missing source image library");
        dae = dae.replace("</library_images>", `<image id="${id}"><init_from>${id}.png</init_from></image></library_images>`);
      }
    }
    await writeFile(path.join(work, "model.dae"), dae);
    const raw = path.join(work, "model.glb");
    execFileSync("assimp", ["export", "model.dae", raw, "-embtex"], { cwd: work, stdio: "pipe" });
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const doc = await io.read(raw);
    const root = doc.getRoot();
    const scene = root.listScenes()[0];
    const { min, max } = getBounds(scene);
    const meshes = root.listMeshes();
    if (meshes.length !== item.meshes) throw new Error("Unexpected furniture mesh count");
    const primitives = meshes.flatMap(mesh => mesh.listPrimitives());
    if (primitives.length !== item.meshes) throw new Error("Unexpected furniture primitive count");
    for (const primitive of primitives) {
      if (primitive.getMaterial()?.getName() !== "mGlass" && (!primitive.getAttribute("TEXCOORD_0") || !primitive.getMaterial()?.getBaseColorTexture())) throw new Error("Furniture UVs or albedo missing");
      primitive.setAttribute("JOINTS_0", null).setAttribute("WEIGHTS_0", null).setAttribute("COLOR_0", null);
    }
    for (const extension of root.listExtensionsUsed()) extension.dispose();
    for (const node of root.listNodes()) node.setSkin(null);
    for (const skin of root.listSkins()) skin.dispose();
    // The source is upright and uses ten units per tile. Center and ground the model.
    for (const primitive of primitives) transformPrimitive(primitive, [0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0.1, 0,
      -(min[0] + max[0]) * 0.05, -min[1] * 0.1, -(min[2] + max[2]) * 0.05, 1]);
    for (const material of root.listMaterials()) {
      material.setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1)
        .setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null);
      if (material.getName() === "mGlass") {
        // The source expects a custom glass shader; an opaque export hides the dial.
        material.setAlphaMode("BLEND").setBaseColorFactor([1, 1, 1, 0.08]).setRoughnessFactor(0.2);
      }
    }
    await doc.transform(prune());
    const bounds = getBounds(scene);
    const expected = item.size;
    if (expected.some((size, axis) => Math.abs(bounds.max[axis] - bounds.min[axis] - size) > 0.001)) throw new Error("Furniture size changed");
    await io.write(output, doc);
    console.log(JSON.stringify({ output, bytes: (await stat(output)).size, bounds, sourceVariant: `${item.model}ReBody0`, work }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await restoreFurniture(process.argv[2] || "all", process.argv[3]);
}
