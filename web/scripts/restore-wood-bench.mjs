#!/usr/bin/env node
// Restore the original bench UVs and default wood variant without modifying the source dump.
import { copyFile, mkdtemp, stat } from "node:fs/promises";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { getBounds, prune, transformPrimitive } from "@gltf-transform/functions";

const source = process.argv[2] || path.join(homedir(), "Downloads/Assets/Model");
const output = path.resolve("public/assets/acnh/props/bench-wood.glb");
const work = await mkdtemp(path.join(tmpdir(), "tethos-wood-bench-"));
await copyFile(path.join(source, "FtrWoodBench.Nin_NX_NVN/FtrWoodBench.dae"), path.join(work, "FtrWoodBench.dae"));
for (const suffix of ["Alb", "Nrm", "Mix"]) {
  await copyFile(path.join(source, `FtrWoodBenchReBody0.Nin_NX_NVN/mReBody_${suffix}.png`), path.join(work, `mReBody_${suffix}.png`));
}
const raw = path.join(work, "bench.glb");
execFileSync("assimp", ["export", "FtrWoodBench.dae", raw, "-embtex"], { cwd: work, stdio: "pipe" });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(raw);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const { min, max } = getBounds(scene);
const meshes = root.listMeshes();
if (meshes.length !== 1 || meshes[0].listPrimitives().length !== 1) throw new Error("Unexpected bench mesh count");
const primitive = meshes[0].listPrimitives()[0];
if (!primitive.getAttribute("TEXCOORD_0") || !primitive.getMaterial()?.getBaseColorTexture()) throw new Error("Bench UVs or albedo missing");
for (const extension of root.listExtensionsUsed()) extension.dispose();
primitive.setAttribute("JOINTS_0", null).setAttribute("WEIGHTS_0", null).setAttribute("COLOR_0", null);
for (const node of root.listNodes()) node.setSkin(null);
for (const skin of root.listSkins()) skin.dispose();
// The source uses ten units per tile. Preserve the shipped centered, grounded footprint.
transformPrimitive(primitive, [0.1, 0, 0, 0, 0, 0.1, 0, 0, 0, 0, 0.1, 0,
  -(min[0] + max[0]) * 0.05, -min[1] * 0.1, -(min[2] + max[2]) * 0.05, 1]);
for (const material of root.listMaterials()) {
  material.setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(1)
    .setNormalTexture(null).setOcclusionTexture(null).setMetallicRoughnessTexture(null);
}
await doc.transform(prune());
const bounds = getBounds(scene);
const expected = [1.94533515, 0.51064712, 0.52800059];
if (expected.some((size, axis) => Math.abs(bounds.max[axis] - bounds.min[axis] - size) > 0.001)) throw new Error("Bench size changed");
await io.write(output, doc);
console.log(JSON.stringify({ output, bytes: (await stat(output)).size, bounds, sourceVariant: "FtrWoodBenchReBody0", work }));
