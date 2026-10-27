/**
 * Builds the Face Fit page (specs/lanes/fit-editor.md) into dist/: index.html, editor.js (Editor.tsx with the game's
 * own character code, React and three bundled by esbuild) and the character assets it loads, at relative paths.
 * `node specs/tools/fit-editor/build.mjs` from the repo root (or anywhere).
 */
import { build } from "../../../web/node_modules/esbuild/lib/main.js";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), web = join(here, "../../../web"), out = join(here, "dist");
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
    // is an embedded glTF JSON file (.glb.json, written below): URLs in the web sources and the catalogue JSON follow
    name: "relative-assets",
    setup(b) {
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

// Each GLB as glTF JSON with its BIN chunk as a base64 data URI (GLTFLoader parses either; the extension doesn't matter).
const glbToGltf = buf => {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const jsonLen = buf.readUInt32LE(12), json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen)), bin = 20 + jsonLen;
  if (bin < buf.length) {
    if (buf.readUInt32LE(bin + 4) !== 0x004e4942) throw new Error("second chunk is not BIN");
    if (!json.buffers?.[0] || json.buffers[0].uri) throw new Error("BIN chunk without its buffer");
    json.buffers[0].uri = `data:application/octet-stream;base64,${buf.subarray(bin + 8, bin + 8 + buf.readUInt32LE(bin)).toString("base64")}`;
  }
  return JSON.stringify(json);
};
const walk = dir => readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
for (const f of walk(out).filter(f => f.endsWith(".glb"))) {
  writeFileSync(`${f}.json`, glbToGltf(readFileSync(f)));
  rmSync(f);
}
const big = walk(out).filter(f => statSync(f).size > 16e6);
if (big.length) throw new Error(`over 16 MB: ${big.join(", ")}`);

const size = dir => readdirSync(dir).reduce((n, f) => { const p = join(dir, f), s = statSync(p); return n + (s.isDirectory() ? size(p) : s.size); }, 0);
const files = dir => readdirSync(dir).reduce((n, f) => n + (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : 1), 0);
const mb = size(out) / 1e6;
console.log(`fit-editor: ${files(out)} files, ${mb.toFixed(1)} MB, editor.js ${(statSync(join(out, "editor.js")).size / 1e6).toFixed(2)} MB`);
if (mb > 60) throw new Error("over the 60 MB budget");
