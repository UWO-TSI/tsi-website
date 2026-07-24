// Dump organizer (David ask, 2026-07-24): builds a navigable, categorized
// library over the 12GB ACNH rip WITHOUT copying it. Each item becomes a
// symlink at ~/Downloads/AssetsLibrary/<Category>/<Sub>/<Item> pointing at
// the original .Nin_NX_NVN dir (which holds the .dae + textures), plus a
// manifest.json index for tooling (lab item bench, converters).
//
// Run:  node scripts/organize-dump.mjs [--convert <Category/Sub>]
// The optional --convert pass runs `assimp export` on every .dae in one
// subcategory → .glb alongside the manifest (pilot conversion; scale and
// orientation calibration happen in the game-side import step).
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const SRC = path.join(os.homedir(), "Downloads/Assets/Model");
const OUT = path.join(os.homedir(), "Downloads/AssetsLibrary");

// ACNH naming taxonomy → navigable categories.
const RULES = [
  [/^DiveFish/, "Creatures/SeaCreatures"],
  [/^Fish/, "Creatures/Fish"],
  [/^Ins/, "Creatures/Insects"],
  [/^FtrFish/, "Furniture/FishModels"],
  [/^FtrIns/, "Furniture/InsectModels"],
  [/^Ftr/, "Furniture/General"],
  [/^Layout_MenuIcon_Fish/, "UI/FishIcons"],
  [/^Layout_MenuIcon_Ins/, "UI/InsectIcons"],
  [/^Layout_MenuIcon/, "UI/MenuIcons"],
  [/^Layout/, "UI/Layouts"],
  [/^Idr/, "Interiors/Rooms"],
  [/^Room/, "Interiors/RoomParts"],
  [/^House/, "Buildings/Houses"],
  [/^Npc/, "Characters/NPCs"],
  [/^Player/, "Characters/Player"],
  [/^(Tops|Bottoms|Cap|Shoes|Socks|Accessory|OnePiece|Helmet|Bag)/, "Clothing"],
  [/^Tool/, "Tools"],
  [/^Fld/, "Field"],
  [/^(Tre|Flw|Bush|Plant)/, "Nature"],
  [/^(Str|Unit|Terrain)/, "Terrain"],
];

function categorize(name) {
  for (const [re, cat] of RULES) if (re.test(name)) return cat;
  return "Misc";
}

const entries = fs.readdirSync(SRC).filter((n) => !n.startsWith("."));
const manifest = {};
let linked = 0;

for (const name of entries) {
  const cat = categorize(name);
  const clean = name.replace(/\.Nin_NX_NVN$/, "");
  const destDir = path.join(OUT, cat);
  fs.mkdirSync(destDir, { recursive: true });
  const link = path.join(destDir, clean);
  try {
    if (!fs.existsSync(link)) fs.symlinkSync(path.join(SRC, name), link);
    linked++;
  } catch {
    /* skip broken */
  }
  (manifest[cat] ??= []).push(clean);
}

for (const cat of Object.keys(manifest)) manifest[cat].sort();
fs.writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify(
    { generated: new Date().toISOString(), source: SRC, counts: Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, v.length])), items: manifest },
    null,
    1
  )
);
console.log(`organized ${linked}/${entries.length} items into ${Object.keys(manifest).length} categories → ${OUT}`);
console.log(Object.entries(manifest).map(([k, v]) => `${k}: ${v.length}`).sort().join("\n"));

// Optional pilot conversion of one subcategory.
const ci = process.argv.indexOf("--convert");
if (ci !== -1 && process.argv[ci + 1]) {
  const cat = process.argv[ci + 1];
  const dir = path.join(OUT, cat);
  const glbDir = path.join(OUT, "_glb", cat);
  fs.mkdirSync(glbDir, { recursive: true });
  let ok = 0, fail = 0;
  for (const item of fs.readdirSync(dir)) {
    const src = path.join(dir, item);
    const dae = fs.readdirSync(src).find((f) => f.endsWith(".dae"));
    if (!dae) continue;
    try {
      execFileSync("assimp", ["export", path.join(src, dae), path.join(glbDir, `${item}.glb`)], { stdio: "pipe", timeout: 60000 });
      ok++;
    } catch {
      fail++;
    }
  }
  console.log(`converted ${cat}: ${ok} ok, ${fail} failed → ${glbDir}`);
}
