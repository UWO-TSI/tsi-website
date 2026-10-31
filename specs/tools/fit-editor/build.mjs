/**
 * Builds the Face Fit page (specs/lanes/fit-editor.md) into dist/: index.html, editor.js (Editor.tsx with the game's
 * own character code, React and three bundled by esbuild) and the character assets it loads, at relative paths.
 * `node specs/tools/fit-editor/build.mjs` from the repo root (or anywhere). `build.mjs npc-editor` builds the Residents page
 * (specs/tools/npc-editor/: its own Editor.tsx and index.html, the same loader and assets) into its own dist/.
 */
import { build } from "../../../web/node_modules/esbuild/lib/main.js";
import { NodeIO, VertexLayout } from "../../../web/node_modules/@gltf-transform/core/dist/index.js";
import { ALL_EXTENSIONS } from "../../../web/node_modules/@gltf-transform/extensions/dist/index.js";
import { MeshoptDecoder } from "../../../web/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tool = process.argv[2] ?? "fit-editor", here = join(dirname(fileURLToPath(import.meta.url)), "..", tool);
const web = join(here, "../../../web"), out = join(here, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The thumbnails that exist (hair thumbs, item icons), so the page never asks for a missing one.
const v6 = join(web, "public/assets/characters/v6"), icons = join(web, "public/assets/icons");
const ICON = /^(acc_|hair_|face-).*\.webp$/;
const thumbs = [...readdirSync(join(v6, "hair/thumbs")).map(f => `assets/characters/v6/hair/thumbs/${f}`),
  ...readdirSync(icons).filter(f => ICON.test(f)).map(f => `assets/icons/${f}`)];

await build({
  entryPoints: [join(here, "Editor.tsx")], outfile: join(out, "editor.js"), bundle: true, minify: true, format: "iife",
  target: "es2022", jsx: "automatic", legalComments: "none", logLevel: "warning",
  alias: { "@": web }, nodePaths: [join(web, "node_modules")], tsconfig: join(web, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}", __THUMBS__: JSON.stringify(thumbs) },
  plugins: [{
    // the game serves its assets from the site root, the page beside itself; artifacts don't serve .glb, so every model
    // is a .glb.json (written below, read by Editor.tsx's loader shim): URLs in the web sources and the catalogue follow
    name: "relative-assets",
    setup(b) {
      // the artifact frame's CSP refuses WebAssembly and outside scripts: no meshopt (decoded below) or Draco decoder
      b.onLoad({ filter: /@react-three[\\/]drei[\\/]core[\\/]Gltf\.js$/ }, args => ({
        contents: readFileSync(args.path, "utf8").replace("useDraco = true, useMeshopt = true", "useDraco = false, useMeshopt = false"), loader: "js",
      }));
      const fix = s => s.replaceAll('"/assets/', '"assets/').replace(/\.glb(["`])/g, ".glb.json$1");
      b.onLoad({ filter: /[\\/]web[\\/](components|lib)[\\/].*\.tsx?$/ }, args => ({
        contents: fix(readFileSync(args.path, "utf8")), loader: args.path.endsWith("x") ? "tsx" : "ts",
      }));
      b.onLoad({ filter: /[\\/]web[\\/]data[\\/].*\.json$/ }, args => ({ contents: fix(readFileSync(args.path, "utf8")), loader: "json" }));
    },
  }],
});
cpSync(join(here, "index.html"), join(out, "index.html"));

// The character assets: everything under v6 but the far LODs and the clip libraries the editor never plays.
const skip = new Set(["lod1", "lod2", "base/v7_verbs.glb", "base/v7_clips.glb", "base/v8_staff.glb"]);
cpSync(v6, join(out, "assets/characters/v6"), { recursive: true, filter: src => !skip.has(src.slice(v6.length + 1)) });
// The item icons the list shows (hairstyles, accessories, whole faces), and the bobber the fishing rig preloads.
mkdirSync(join(out, "assets/icons"), { recursive: true });
for (const f of readdirSync(icons)) if (ICON.test(f)) cpSync(join(icons, f), join(out, "assets/icons", f));
cpSync(join(web, "public/assets/game/tools/bobber.glb"), join(out, "assets/game/tools/bobber.glb"));
// The Residents page draws the new world's map: its two images, fetched beside the page (the document is bundled).
if (tool === "npc-editor") for (const f of ["height.png", "surface.png"]) cpSync(join(web, "data/world", f), join(out, "data/world", f));

// Each GLB as a .glb.json: the whole GLB in base64, as a JSON string. The artifact frame's CSP lets the page fetch its
// own files but not data: or blob: URLs, nor compile WebAssembly, so the meshopt compression is decoded here and every
// embedded image becomes its own file beside the model (<model>.glb.<i>.png), fetched by a relative URL.
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder })
  .setVertexLayout(VertexLayout.SEPARATE);                               // as the game's files: the merge can't mix interleaved
const pad = (b, fill) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
async function convert(file) {
  const doc = await io.read(file);
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === "EXT_meshopt_compression") e.dispose();
  const glb = Buffer.from(await io.writeBinary(doc)), jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString("utf8", 20, 20 + jsonLen)), bin = glb.subarray(20 + jsonLen);
  const binStart = 8;                                                    // the BIN chunk's data, after its header
  (json.images ?? []).forEach((img, i) => {
    if (img.bufferView === undefined) return;
    const v = json.bufferViews[img.bufferView], ext = img.mimeType === "image/jpeg" ? "jpg" : img.mimeType === "image/webp" ? "webp" : "png";
    const name = `${file.slice(file.lastIndexOf("/") + 1)}.${i}.${ext}`;
    writeFileSync(join(dirname(file), name), bin.subarray(binStart + (v.byteOffset ?? 0), binStart + (v.byteOffset ?? 0) + v.byteLength));
    img.uri = name; delete img.bufferView; delete img.mimeType;
  });
  const head = pad(Buffer.from(JSON.stringify(json)), 0x20), total = 12 + 8 + head.length + bin.length;
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
  header.writeUInt32LE(head.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return JSON.stringify(Buffer.concat([header, head, bin]).toString("base64"));
}
const walk = dir => readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
for (const f of walk(out).filter(f => f.endsWith(".glb"))) {
  writeFileSync(`${f}.json`, await convert(f));
  rmSync(f);
}
const big = walk(out).filter(f => statSync(f).size > 16e6);
if (big.length) throw new Error(`over 16 MB: ${big.join(", ")}`);

const size = dir => readdirSync(dir).reduce((n, f) => { const p = join(dir, f), s = statSync(p); return n + (s.isDirectory() ? size(p) : s.size); }, 0);
const files = dir => readdirSync(dir).reduce((n, f) => n + (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : 1), 0);
const mb = size(out) / 1e6;
console.log(`${tool}: ${files(out)} files, ${mb.toFixed(1)} MB, editor.js ${(statSync(join(out, "editor.js")).size / 1e6).toFixed(2)} MB`);
if (mb > 60) throw new Error("over the 60 MB budget");
