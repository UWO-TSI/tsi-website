/**
 * Builds the Face Fit page (specs/lanes/fit-editor.md) into dist/: index.html, editor.js (Editor.tsx with the game's
 * own character code, React and three bundled by esbuild) and the character assets it loads, at relative paths.
 * `node specs/tools/fit-editor/build.mjs` from the repo root (or anywhere).
 */
import { build } from "../../../web/node_modules/esbuild/lib/main.js";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
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
    // the game serves its assets from the site root; the page serves them beside itself
    name: "relative-assets",
    setup(b) {
      b.onLoad({ filter: /[\\/]web[\\/](components|lib)[\\/].*\.tsx?$/ }, args => ({
        contents: readFileSync(args.path, "utf8").replaceAll('"/assets/', '"assets/'), loader: args.path.endsWith("x") ? "tsx" : "ts",
      }));
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

const size = dir => readdirSync(dir).reduce((n, f) => { const p = join(dir, f), s = statSync(p); return n + (s.isDirectory() ? size(p) : s.size); }, 0);
const files = dir => readdirSync(dir).reduce((n, f) => n + (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : 1), 0);
const mb = size(out) / 1e6;
console.log(`fit-editor: ${files(out)} files, ${mb.toFixed(1)} MB, editor.js ${(statSync(join(out, "editor.js")).size / 1e6).toFixed(2)} MB`);
if (mb > 60) throw new Error("over the 60 MB budget");
