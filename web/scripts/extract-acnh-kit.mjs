#!/usr/bin/env node
/**
 * extract-acnh-kit — the committed ACNH dump -> GLB extractor (M1, 2026-07-26).
 *
 * WHY THIS EXISTS: the pipeline that produced the current
 * public/assets/acnh/ files was ad-hoc and never committed (noted in
 * specs/sprint-2026-07-refinement.md). An audit of all 266 shipped GLBs found
 * 12 with gaps in their mesh numbering. Some of those drops were real damage —
 * every river bank piece lost `Grass__mGrass`, its own GROUND SURFACE, and the
 * chalets lost their windows, curtains and lamp. Others were the effect layers
 * listed under EFFECT_MATERIALS, which genuinely must not ship.
 *
 * THE RULE THIS ENFORCES: a `.dae` declares N `<geometry>` elements. After
 * subtracting the effect layers we remove on purpose, the exported `.glb` must
 * contain at least that many meshes. Fewer means geometry was lost by accident,
 * and we refuse to write the file rather than ship a partial asset. (More is
 * fine and expected: assimp splits a geometry per material.)
 *
 * It also strips skinning, which is load-bearing — see stripSkinning.
 *
 * Usage:
 *   node scripts/extract-acnh-kit.mjs --kit FldUnitCliff --out cliff
 *   node scripts/extract-acnh-kit.mjs --kit PltTreeOakSakura --out plants \
 *        --only PltTreeOak4Sakura --name tree-blossom
 *   node scripts/extract-acnh-kit.mjs --audit          # check what is shipped
 *   ... add --dry to preview without writing.
 *
 * Textures are EMBEDDED (assimp -embtex). The alternative — external URIs —
 * is exactly how the brick road kit shipped broken: brick-*.glb referenced
 * five textures that were never copied, so the plaza rendered untextured and
 * the browser logged persistent 404s. Embedding costs disk (each piece carries
 * its own copy) and that duplication is a known optimisation for the grid
 * renderer, which will assign ONE shared material per surface type by material
 * name and ignore the per-piece materials entirely.
 *
 * See specs/acnh-system-reference.md for the kit vocabulary and constants.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { NodeIO } from "@gltf-transform/core";
import { prune, textureCompress, transformPrimitive } from "@gltf-transform/functions";
import sharp from "sharp";

// ── Texture budget (David ruling, 2026-07-26) ────────────────────
// assimp -embtex faithfully embeds everything Nintendo authored, which is far
// more than this renderer can use: the oracle came out at 5.7MB, 5.24MB of it
// textures, including two 1536x1536 normal maps worth 2.8MB on their own.
//
// The game renders at 0.66-2 dpr through a desaturating pastel grade with
// objects small on screen, so normal / metallic-roughness / occlusion maps
// buy essentially nothing here. We drop those three slots and cap colour at
// 512px, which lands close to the sizes the project was already shipping.
// Alpha masks are kept — foliage and the grass-fringe overlays need them.
const MAX_TEXTURE = 512;
const DROPPED_SLOTS = ["normalTexture", "metallicRoughnessTexture", "occlusionTexture"];

// ── Engine-specific effect meshes (measured 2026-07-26) ──────────
//
// Not every mesh in a source .dae is renderable geometry. ACNH ships effect
// layers that its own renderer draws with custom blending, and glTF has no way
// to carry that intent — exported as ordinary PBR they come out OPAQUE:
//
//   mShadow / mShadowShake  the baked contact shadow + falling-petal layer.
//                           Meant to be multiply-blended onto the ground.
//                           As standard PBR they render as a solid white/grey
//                           mass swallowing the tree canopy.
//   mWinterSnow             the seasonal snow overlay, full building size.
//                           ACNH swaps it in during winter; drawn always, every
//                           roof is permanently snow-capped.
//   mSoftMesh               soft shadow blob, same family as mShadow.
//
// The lost original pipeline dropped these, which is WHY the shipped assets
// looked right. Excluding them here is deliberate and reported, unlike that
// pipeline's silent drops — the mesh-count gate below subtracts them so a real
// geometry loss is still caught.
//
// FOLLOW-UP worth doing: mShadow IS the ACNH contact shadow, and wiring it with
// a multiply-blend material would let us delete the realtime shadow map (~7 FPS
// on M1, and misaligned per D1). That needs a custom material, not an export
// flag, so it is its own task.
const EFFECT_MATERIALS = [/mShadow/i, /mShadowShake/i, /mWinterSnow/i, /mSoftMesh/i];

function isEffectMaterial(name) {
  return !!name && EFFECT_MATERIALS.some((re) => re.test(name));
}

const DUMP = path.join(os.homedir(), "Downloads/Assets/Model");
const PUBLIC_ACNH = path.resolve(process.cwd(), "public/assets/acnh");

// ── Naming ───────────────────────────────────────────────────────
// Kit pieces are {Kit}{Class}{Variant}_{Rotation}. We flatten to
// `{class}-{variant}-{rotation}.glb`, extending the dash convention the road
// kit already ships (`4-a.glb`, `2-b.glb`) with the rotation the cliff and
// river kits add. Rotation is dropped when a piece has only one.
const NAMERS = {
  // Cliff2B_0 -> 2-b-0 · Cliff0A_0 -> 0-a-0
  autotile: (stem, kitPrefix) => {
    const m = new RegExp(`^${kitPrefix}(\\d+)([A-Z])_(\\d+)$`).exec(stem);
    if (!m) return null;
    return `${m[1]}-${m[2].toLowerCase()}-${m[3]}`;
  },
  // Fall100_0 -> 100-0
  fall: (stem) => {
    const m = /^Fall(\d+)_(\d+)$/.exec(stem);
    return m ? `${m[1]}-${m[2]}` : null;
  },
};

const KITS = {
  FldUnitCliff: { out: "cliff", namer: (s) => NAMERS.autotile(s, "Cliff") },
  FldUnitRiver: { out: "river", namer: (s) => NAMERS.autotile(s, "River") },
  FldUnitFall: { out: "fall", namer: NAMERS.fall },
};

// ── GLB / DAE inspection ─────────────────────────────────────────

function glbJson(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  return JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString("utf8"));
}

/** Meshes actually present in an exported GLB (primitives, not mesh nodes). */
function glbMeshCount(file) {
  const j = glbJson(file);
  return (j.meshes || []).reduce((n, m) => n + m.primitives.length, 0);
}

/** Geometry count declared by the source Collada file. */
function daeGeometryCount(file) {
  const src = fs.readFileSync(file, "utf8");
  return (src.match(/<geometry[\s>]/g) || []).length;
}

/**
 * Gaps in `_meshN` suffixes prove the exporter dropped geometry — the broken
 * files preserve the ORIGINAL indices in their mesh names, so 0,2,4 out of 0..4
 * is a two-mesh drop. This is how the 12 bad assets were found.
 */
function droppedMeshIndices(file) {
  const j = glbJson(file);
  const idx = (j.meshes || [])
    .map((m) => {
      const mm = /_mesh(\d+)$/.exec(m.name || "");
      return mm ? Number(mm[1]) : null;
    })
    .filter((v) => v !== null);
  if (idx.length < 2) return 0;
  return Math.max(...idx) + 1 - idx.length;
}

// ── Extraction ───────────────────────────────────────────────────

/**
 * Strip the texture slots we do not render, drop whatever that orphans, and
 * cap the survivors. Runs BEFORE the mesh-count gate on purpose: if pruning
 * ever removed real geometry, the gate would catch it and refuse the write.
 */
/**
 * Some source .dae files reference textures the rip never captured. The
 * museum points at `mWinterSnow_Nrm.jpg`; every chalet wall points at
 * `mCurtain_*.jpg`, `mHouseInner_Alb.jpg` and `mWindowGlass_Mix.jpg`. None of
 * those exist anywhere in the dump — they live in a shared archive the rip
 * did not include. assimp writes the dangling uri regardless, and then the
 * glTF reader cannot open the document at all.
 *
 * Satisfy every external reference next to the GLB: the real texture when the
 * dump has it, otherwise a 1x1 stub. The stub MUST match the extension —
 * writing a PNG named `.jpg` makes the downstream encoder try to decode it as
 * JPEG and fail with "Corrupt JPG, exceeded buffer limits".
 *
 * In practice the stubs are harmless: all but `mCurtain_Alb` are Nrm/Mix maps
 * we drop anyway, and curtains sit behind window glass.
 */
async function satisfyExternalImages(file, srcDir) {
  const dir = path.dirname(file);
  const stubbed = [];
  for (const im of glbJson(file).images || []) {
    if (!im.uri || im.uri.startsWith("data:")) continue;
    const dest = path.join(dir, im.uri);
    if (fs.existsSync(dest)) continue;
    const fromDump = path.join(srcDir, im.uri);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(fromDump)) {
      fs.copyFileSync(fromDump, dest);
      continue;
    }
    const jpeg = /\.jpe?g$/i.test(im.uri);
    const img = sharp({
      create: { width: 1, height: 1, channels: jpeg ? 3 : 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    });
    await (jpeg ? img.jpeg() : img.png()).toFile(dest);
    stubbed.push(im.uri);
  }
  return stubbed;
}

/**
 * Strip skinning. THIS IS LOAD-BEARING, not a size optimisation.
 *
 * Every ACNH source .dae carries an Armature (Nintendo rigs props for wind and
 * terraform animation), so assimp exports skinned meshes bound to a skeleton.
 * This renderer clones props with a plain `scene.clone(true)` — see GLBProp in
 * NatureModels.tsx — and THREE's plain clone does not rebind a skeleton. The
 * clone keeps pointing at the original bones, so every vertex resolves against
 * the wrong matrices and the model explodes into screen-filling shards.
 *
 * `/lab/item` already documents the same trap: "SkeletonUtils.clone: skinned
 * dump models ignore the fixRot wrapper with a plain clone (they stay bound to
 * the original skeleton)."
 *
 * The lost original pipeline stripped skinning — the shipped files have zero
 * skins — and everything downstream depends on that. We render these props
 * static, so the rig is dead weight anyway. Drop the joint bindings and let
 * prune() collect the skeleton.
 */
// (name kept: it also drops COLOR_0, see below)
function stripSkinning(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      prim.setAttribute("JOINTS_0", null);
      prim.setAttribute("WEIGHTS_0", null);
      // COLOR_0 is the same class of problem. ACNH stores per-vertex WIND SWAY
      // weights there, not colour — but glTF says COLOR_0 multiplies base
      // colour, and GLTFLoader turns on vertexColors whenever the attribute
      // exists. The sway data then renders as neon yellow/cyan/green canopies
      // that bloom (David report, 2026-07-26: "the trees are glowing lime
      // green"). Buildings were unaffected because they carry no COLOR_0.
      // The previously shipped plants have no COLOR_0 either — dropping it was
      // load-bearing, exactly like the skinning strip.
      prim.setAttribute("COLOR_0", null);
    }
  }
  for (const node of doc.getRoot().listNodes()) node.setSkin(null);
  for (const skin of doc.getRoot().listSkins()) skin.dispose();
}

/**
 * Bake a uniform scale INTO THE VERTEX DATA.
 *
 * WHY a scale at all: this repo does not use one convention. `plants/` ships
 * WORLD-scale (the dump's 10u tile pre-divided by 10, see NatureModels.tsx
 * "models ship world-scale"), while `buildings/` ships RAW and gets ACNH_SCALE
 * applied in Building.tsx. Exporting plants raw put 33-unit cherry trees in the
 * village.
 *
 * WHY vertex data and not a scaled wrapper node: `InstancedGLB`
 * (InstancedNature.tsx) renders the tree field, and its extractSubMeshes()
 * pulls `{ geometry, material }` straight off each mesh and hands the geometry
 * to drei's <Instances> — the node hierarchy, and therefore any parent scale,
 * is DISCARDED. A wrapper node is honoured by GLBProp's scene.clone(true) but
 * silently ignored by the instanced path, so trees looked right in isolation
 * and rendered 10x oversized in the world as giant green shards.
 *
 * Baking into positions means every consumer gets the same size no matter how
 * it loads the file. This is also how the previously shipped plants were
 * authored: their accessor bounds are already world-scale.
 */
function bakeScale(doc, factor) {
  if (factor === 1) return;
  const m = [factor, 0, 0, 0, 0, factor, 0, 0, 0, 0, factor, 0, 0, 0, 0, 1];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) transformPrimitive(prim, m);
  }
}

async function slimTextures(file, srcDir, scaleFactor) {
  const stubbed = await satisfyExternalImages(file, srcDir);
  const io = new NodeIO();
  const doc = await io.read(file);
  stripSkinning(doc);

  // Drop the effect layers (see EFFECT_MATERIALS). Report them so this stays
  // an explicit exclusion rather than a silent one.
  const dropped = [];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const matName = prim.getMaterial()?.getName();
      if (!isEffectMaterial(matName) && !isEffectMaterial(mesh.getName())) continue;
      dropped.push(matName || mesh.getName());
      mesh.removePrimitive(prim);
      prim.dispose();
    }
    if (mesh.listPrimitives().length === 0) {
      for (const node of doc.getRoot().listNodes()) if (node.getMesh() === mesh) node.dispose();
      mesh.dispose();
    }
  }

  bakeScale(doc, scaleFactor);

  for (const material of doc.getRoot().listMaterials()) {
    for (const slot of DROPPED_SLOTS) {
      const setter = `set${slot[0].toUpperCase()}${slot.slice(1)}`;
      if (typeof material[setter] === "function") material[setter](null);
    }
  }

  // prune clears the textures/images those slots were the last reference to,
  // which also takes out any unresolved EXTERNAL image uri assimp left behind
  // (the oracle shipped one: mWinterSnow_Nrm.jpg, a guaranteed 404).
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, resize: [MAX_TEXTURE, MAX_TEXTURE] })
  );

  await io.write(file, doc);
  return { stubbed, dropped };
}

async function extractOne(daePath, outPath, { dry, scaleFactor }) {
  const expected = daeGeometryCount(daePath);
  if (dry) return { ok: true, expected, got: null, dry: true };

  const tmp = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "acnh-kit-")),
    path.basename(outPath)
  );
  try {
    execFileSync("assimp", ["export", path.basename(daePath), tmp, "-embtex"], {
      stdio: "pipe",
      timeout: 120000,
      cwd: fs.realpathSync(path.dirname(daePath)),
    });
  } catch (err) {
    return { ok: false, expected, got: null, reason: `assimp failed: ${err.message.split("\n")[0]}` };
  }
  if (!fs.existsSync(tmp)) return { ok: false, expected, got: null, reason: "assimp wrote nothing" };

  const rawBytes = fs.statSync(tmp).size;
  let stubbed = [];
  let dropped = [];
  try {
    ({ stubbed, dropped } = await slimTextures(tmp, path.dirname(daePath), scaleFactor));
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    return { ok: false, expected, got: null, reason: `texture slim failed: ${err.message.split("\n")[0]}` };
  }

  const got = glbMeshCount(tmp);
  // THE GATE. Refuse to write a partial asset — this is the whole point.
  // Effect layers we removed on purpose are subtracted, so the gate still
  // catches geometry the exporter lost by accident.
  const wanted = expected - dropped.length;
  if (got < wanted) {
    fs.rmSync(tmp, { force: true });
    return { ok: false, expected: wanted, got, reason: `DROPPED GEOMETRY (${wanted - got} of ${wanted})` };
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.copyFileSync(tmp, outPath);
  fs.rmSync(tmp, { force: true });
  return { ok: true, expected: wanted, got, bytes: fs.statSync(outPath).size, rawBytes, stubbed, dropped };
}

// ── Modes ────────────────────────────────────────────────────────

function audit() {
  const dropped = [];
  const dangling = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".glb")) {
        const rel = path.relative(PUBLIC_ACNH, p);
        try {
          const n = droppedMeshIndices(p);
          if (n > 0) dropped.push({ file: rel, n });
          // Second failure mode, same family: an EXTERNAL texture uri whose
          // file is not actually on disk next to the GLB. This is how the
          // brick plaza shipped untextured for months, logging persistent
          // 404s that nobody was watching for.
          const missing = (glbJson(p).images || [])
            .map((im) => im.uri)
            .filter((uri) => uri && !uri.startsWith("data:"))
            .filter((uri) => !fs.existsSync(path.join(path.dirname(p), uri)));
          if (missing.length) dangling.push({ file: rel, missing });
        } catch {
          dropped.push({ file: rel, n: "UNREADABLE" });
        }
      }
    }
  })(PUBLIC_ACNH);

  if (!dropped.length && !dangling.length) {
    console.log("audit: clean — no dropped meshes, no dangling texture refs");
    return 0;
  }
  if (dropped.length) {
    console.log(`audit: ${dropped.length} file(s) with dropped geometry`);
    for (const r of dropped) console.log(`  ${r.file.padEnd(36)} dropped ${r.n}`);
  }
  if (dangling.length) {
    console.log(`\naudit: ${dangling.length} file(s) referencing textures that are not on disk (guaranteed 404s)`);
    for (const r of dangling) console.log(`  ${r.file.padEnd(36)} ${r.missing.join(", ")}`);
  }
  return 1;
}

async function run() {
  const argv = process.argv.slice(2);
  const arg = (k) => {
    const i = argv.indexOf(k);
    return i === -1 ? null : argv[i + 1];
  };
  const dry = argv.includes("--dry");

  if (argv.includes("--audit")) process.exit(audit());

  const kitName = arg("--kit");
  if (!kitName) {
    console.error("usage: --kit <DumpDirName> [--out <subdir>] [--only <stem>] [--name <basename>] [--scale <n>] [--dry] | --audit");
    process.exit(2);
  }

  const srcDir = path.join(DUMP, `${kitName}.Nin_NX_NVN`);
  if (!fs.existsSync(srcDir)) {
    console.error(`no such kit in the dump: ${srcDir}`);
    process.exit(2);
  }

  const preset = KITS[kitName] || {};
  const outSub = arg("--out") || preset.out;
  if (!outSub) {
    console.error("--out is required for kits without a preset");
    process.exit(2);
  }
  const only = arg("--only");
  // plants/ ship world-scale, buildings/ ship raw — see bakeScale().
  const scaleFactor = arg("--scale") ? Number(arg("--scale")) : 1;
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    console.error("--scale must be a positive number");
    process.exit(2);
  }
  const forcedName = arg("--name");
  const outDir = path.join(PUBLIC_ACNH, outSub);

  const daes = fs
    .readdirSync(srcDir)
    .filter((f) => f.endsWith(".dae"))
    .filter((f) => !only || path.basename(f, ".dae") === only)
    .sort();

  if (daes.length === 0) {
    console.error(`no .dae matched in ${kitName}${only ? ` for --only ${only}` : ""}`);
    process.exit(2);
  }

  console.log(`${kitName}: ${daes.length} source file(s) -> ${path.relative(process.cwd(), outDir)}${dry ? "  [DRY RUN]" : ""}\n`);

  let ok = 0;
  const failures = [];
  for (const dae of daes) {
    const stem = path.basename(dae, ".dae");
    const name = forcedName || (preset.namer ? preset.namer(stem) : null) || stem.toLowerCase();
    const res = await extractOne(path.join(srcDir, dae), path.join(outDir, `${name}.glb`), { dry, scaleFactor });
    if (res.ok) {
      ok++;
      const size = res.bytes
        ? `${(res.bytes / 1024).toFixed(0)}KB${res.rawBytes ? ` (from ${(res.rawBytes / 1024).toFixed(0)}KB)` : ""}`
        : "";
      const fx = res.dropped?.length ? `  [effect layers dropped: ${[...new Set(res.dropped)].join(", ")}]` : "";
      console.log(`  ok   ${stem.padEnd(20)} -> ${`${name}.glb`.padEnd(16)} ${res.expected} geo -> ${res.got ?? "?"} mesh  ${size}${fx}`);
    } else {
      failures.push({ stem, ...res });
      console.log(`  FAIL ${stem.padEnd(20)} ${res.reason}`);
    }
  }

  console.log(`\n${ok}/${daes.length} extracted${failures.length ? `, ${failures.length} REFUSED` : ""}`);
  if (failures.length) {
    console.log("\nRefused files were NOT written. Partial assets are the bug this script exists to prevent.");
    process.exit(1);
  }
}

await run();
